# ReachInbox / Outbox - Full-Stack Email Job Scheduler & Operations Engine

A production-grade, interview-explainable full-stack email scheduling platform built for the **ReachInbox / Outbox Labs** Software Development Intern assignment.

Engineered with a **modular monolith** backend in TypeScript and Express, persistent background queue execution via **BullMQ + Redis**, atomic rate limiting via **Redis Lua scripts**, fake SMTP delivery with **Ethereal Email**, search indexing via **Elasticsearch**, real **Google & Slack OAuth integrations**, live queue telemetry on **Bull Board**, and a polished **React + Tailwind CSS** dashboard.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (React 18 + Vite + Tailwind CSS)"]
        UI["Dashboard & Active Campaign Progress"]
        Compose["Compose Modal (CSV Deduplicator & Parser)"]
        AuthUI["Google Sign-In & Slack Connect Badge"]
    end

    subgraph BackendAPI ["Modular Monolith Backend (Express + TypeScript)"]
        CampaignCtrl["CampaignController / EmailController"]
        CampaignSvc["CampaignService"]
        SchedulerSvc["EmailSchedulerService"]
        SearchSvc["SearchService (ES + PostgreSQL Fallback)"]
        BullBoardUI["Bull Board Dashboard (/admin/queues)"]
    end

    subgraph DataStorage ["Persistence & Storage Layer"]
        PG[("PostgreSQL 16\n(Primary Source of Truth)")]
        RedisDB[("Redis 7\n(BullMQ & Atomic Lua State)")]
        ES[("Elasticsearch 8.13\n(Search Index)")]
    end

    subgraph BackgroundWorker ["Email Worker Process (BullMQ)"]
        Worker["Worker Process (Concurrency: N)"]
        ClaimGuard["Atomic DB Claim Guard\n(scheduled -> processing)"]
        LuaLimiter["Atomic Redis Lua Rate Limiter"]
        DelayGuard["Per-Sender Spacing Guard"]
        CrashRecovery["Stale Processing Sweeper"]
    end

    subgraph ExternalServices ["External Providers"]
        EtherealSMTP["Ethereal Fake SMTP\n(Nodemailer)"]
        SlackAPI["Slack OAuth & Webhook API"]
    end

    UI -->|Schedule Campaign| CampaignCtrl
    CampaignCtrl --> CampaignSvc
    CampaignSvc -->|1. Save Campaign & Emails| PG
    CampaignSvc --> SchedulerSvc
    SchedulerSvc -->|2. Queue Delayed Jobs (Deterministic IDs)| RedisDB
    CampaignSvc -.->|Async Non-blocking Index| ES

    RedisDB -->|Delayed Job Triggers| Worker
    Worker --> ClaimGuard
    ClaimGuard -->|Atomic Claim| PG
    Worker --> LuaLimiter
    LuaLimiter -- Limit Exceeded -->|Reschedule Job to Next Hour| RedisDB
    LuaLimiter -- Limit Exceeded -->|Send Alert| SlackAPI
    Worker --> DelayGuard
    Worker -->|Send SMTP| EtherealSMTP
    Worker -->|Update status -> sent| PG
    Worker -.->|Async Indexing| ES

    SearchSvc -->|Fast Search| ES
    SearchSvc -.->|Graceful Fallback| PG
    BullBoardUI -->|Queue Telemetry| RedisDB
```

---

## Why Each Storage Technology Exists

| Technology | Role | Why It Exists in This System |
| :--- | :--- | :--- |
| **PostgreSQL** | **Primary Source of Truth** | Maintains relational integrity across `User`, `Campaign`, `Sender`, `Email`, and `SlackConnection`. Provides ACID guarantees for atomic state claiming (`scheduled` $\rightarrow$ `processing` $\rightarrow$ `sent`) and crash recovery audits. |
| **Redis + BullMQ** | **Persistent Job Scheduler & Distributed State** | Manages delayed execution without cron jobs. Ensures jobs survive server restarts, coordinates atomic sliding-window rate limiting via Redis Lua scripts across multiple worker processes, and tracks per-sender minimum delays. |
| **Elasticsearch** | **Search Index (Secondary)** | Provides fast full-text search across recipients, subjects, and statuses. Treated strictly as secondary: indexed asynchronously so any Elasticsearch hiccup never blocks or rolls back email sending. |

---

## Core System & Engineering Guarantees

### 1. Persistent Scheduling Without Cron
- Scheduled emails are added as **BullMQ delayed jobs** with explicit millisecond delays calculated from `scheduledAt - now`.
- Uses deterministic job IDs: `email-${emailId}`.
- If the server or worker restarts, Redis preserves all pending delayed jobs; when the scheduled timestamp arrives, jobs fire without re-starting from scratch or duplicating.
- **No OS cron, no node-cron, and no setInterval scheduler loops**.

### 2. Atomic Rate Limiting (Redis Lua Script)
- When multiple worker processes run concurrently, a naive `GET count` followed by `INCR` has a race condition where concurrent workers exceed the hourly limit.
- We enforce hourly limits using an **atomic Redis Lua script** (`RateLimiterService.ts`):
  ```lua
  local current = redis.call('GET', KEYS[1])
  if current and tonumber(current) >= tonumber(ARGV[1]) then
    return 0 -- Limit exceeded
  end
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
  end
  return 1 -- Allowed
  ```
- If the limit is reached:
  - The email is **never permanently failed**.
  - Its database state is preserved as `scheduled`.
  - The BullMQ job is rescheduled to the start of the next hour window (`windowKey + 3600s`).
  - An alert is sent to the user's connected Slack workspace (deduplicated per hour window so Slack is not spammed).

### 3. Per-Sender Minimum Delay
- Individual email providers throttle rapid-fire bursts from the same sender.
- The system enforces a configurable minimum delay (default: `2,000ms`) per sender via Redis key `ratelimit:sender:{senderId}:last_send`.
- If a sender sent an email less than `MIN_EMAIL_DELAY_MS` ago, the worker pauses or yields the remaining milliseconds before executing the SMTP send.

### 4. Idempotency & Multi-Worker Concurrency
- Configurable worker concurrency (`WORKER_CONCURRENCY=5`).
- Before sending, a worker must atomically claim the email in PostgreSQL:
  ```sql
  UPDATE emails
  SET status = 'processing', "updatedAt" = NOW()
  WHERE id = $emailId AND status = 'scheduled';
  ```
- If `affectedRows === 0`, another worker already claimed the job or the email was already sent/cancelled. The worker cleanly skips processing.

### 5. Worker Crash Recovery
- If a worker crashes mid-send while an email is in `processing` status, `RecoveryService` sweeps records that have been in `processing` for more than 5 minutes, resets them to `scheduled`, and re-queues them into BullMQ.
- We explicitly acknowledge that true distributed exactly-once delivery across external SMTP servers and relational databases requires provider-level idempotency headers; application-level idempotency and crash sweepers provide practical protection against duplicate sends.

### 6. Asynchronous Non-Blocking Elasticsearch
- After the database record is updated to `sent`, the email is asynchronously indexed in Elasticsearch.
- If Elasticsearch is degraded or unreachable, the error is logged as a non-fatal warning; the email remains `sent` in PostgreSQL and user state is never corrupted.
- `GET /api/emails/search?q=` automatically falls back to PostgreSQL `ILIKE` queries if Elasticsearch is temporarily unavailable.

---

## Project Structure

```text
outbox/
├── docker-compose.yml              # PostgreSQL, Redis, Elasticsearch
├── .env.example                    # Documented configuration template
├── backend/
│   ├── prisma/
│   │   └── schema.prisma           # Prisma schema (User, Campaign, Sender, Email, SlackConnection)
│   ├── src/
│   │   ├── config/                 # Typed env, Redis connection
│   │   ├── controllers/            # Thin REST controllers (Campaign, Email, Auth, Search, Health)
│   │   ├── db/                     # Prisma singleton
│   │   ├── queues/                 # BullMQ queue definition & configuration
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/
│   │   │   ├── campaignService.ts  # Campaign creation & lead scheduling orchestration
│   │   │   ├── emailSchedulerService.ts # BullMQ delayed job management
│   │   │   ├── emailService.ts     # Nodemailer & Ethereal SMTP integration
│   │   │   ├── rateLimiterService.ts # Atomic Redis Lua rate limiting & delay guards
│   │   │   ├── recoveryService.ts  # Stale processing crash recovery sweeper
│   │   │   ├── searchService.ts    # Elasticsearch indexing with DB fallback
│   │   │   ├── authService.ts      # Google OAuth 2.0 flow
│   │   │   └── slackService.ts     # Slack OAuth & rate limit alerts
│   │   ├── workers/                # BullMQ Worker implementation
│   │   ├── utils/                  # CSV parser & email RFC validator
│   │   ├── types/                  # Shared TypeScript interfaces
│   │   ├── app.ts                  # Express application factory with Bull Board
│   │   ├── server.ts               # API server entry point
│   │   ├── worker.ts               # Standalone worker entry point
│   │   └── scripts/
│   │       └── reliabilityChaosTest.ts # Concurrency & rate-limit stress test
│   └── src/__tests__/              # Vitest test suites
└── frontend/
    ├── src/
    │   ├── components/             # Reusable UI (Navbar, StatCard, CampaignProgress, Tables, Modal)
    │   ├── services/               # API client
    │   ├── types/                  # Frontend data contracts
    │   ├── App.tsx                 # Main application with real-time polling
    │   └── index.css               # Tailwind CSS styles & dark theme
    └── vite.config.ts
```

---

## Local Setup & Quickstart

### Prerequisites
- **Node.js** v20+ & **npm** v10+
- **Docker** and **Docker Compose**

### Step 1: Start Infrastructure (PostgreSQL, Redis, Elasticsearch)
From the repository root:
```bash
docker compose up -d
```
Verify containers are healthy:
```bash
docker ps
```
Ports exposed:
- **PostgreSQL**: `localhost:5433`
- **Redis**: `localhost:6380`
- **Elasticsearch**: `localhost:9200`

### Step 2: Backend Setup & Database Migration
```bash
cd backend
npm install
npm run db:push
```

### Step 3: Run the Services
Open 3 terminal windows:

**Terminal 1 — API Server:**
```bash
cd backend
npm run dev:server
# API running on http://localhost:5000
# Bull Board monitor at http://localhost:5000/admin/queues
```

**Terminal 2 — Background Worker:**
```bash
cd backend
npm run dev:worker
# Email Worker started with configured concurrency
```

**Terminal 3 — Frontend Dashboard:**
```bash
cd frontend
npm install
npm run dev
# Dashboard running on http://localhost:5173
```

---

## Health Check & Monitoring

### Health Endpoint
`GET http://localhost:5000/health`
```json
{
  "status": "ok",
  "timestamp": "2026-09-17T14:30:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "elasticsearch": "ok"
  }
}
```

### Live BullMQ Telemetry (Bull Board)
Visit: `http://localhost:5000/admin/queues`
Inspect delayed, waiting, active, completed, and failed jobs in real-time.

---

## Testing & Reliability Verification

### Run the Unit & Integration Test Suite
```bash
cd backend
npm test
```
Covers:
- Health check and Redis/DB pings.
- Campaign creation and BullMQ delayed job creation.
- Worker execution and Ethereal preview generation.
- Atomic DB claim idempotency (`scheduled` $\rightarrow$ `processing`).
- Atomic Redis Lua rate limiting and next-hour rescheduling.
- Stale processing crash recovery sweeper.
- Elasticsearch search and graceful PostgreSQL fallback.
- CSV parsing, RFC email validation, and duplicate removal.
- Google Auth and Slack OAuth helpers.

### Run the Chaos & Reliability Stress Test
```bash
cd backend
npm run test:reliability
```
Simulates:
- 15 leads scheduled under a tight rate limit (`5 emails/hour`).
- 3 concurrent worker processes competing for the same jobs.
- Verifies:
  1. Exactly 5 emails sent (capped by rate limit).
  2. Remaining 10 emails rescheduled to next hour window (zero emails dropped).
  3. Zero emails permanently failed.
  4. Idempotency verified: zero duplicate sends across workers.

---

## 5-Minute Demo Walkthrough Script

1. **Start System**:
   - `docker compose up -d`
   - Start API (`npm run dev:server`), Worker (`npm run dev:worker`), and Frontend (`npm run dev`).
2. **Open Dashboard** (`http://localhost:5173`):
   - Note the user profile (Vikas Tiwari), stat cards, and Slack status.
3. **Open Bull Board** (`http://localhost:5000/admin/queues`):
   - Show the queue state is clean and waiting.
4. **Compose Campaign with CSV**:
   - Click **+ Compose Campaign**.
   - Enter Subject: `Outbox Partnership Opportunity`.
   - Upload a CSV of leads (e.g. 10 leads with 1 duplicate).
   - Show the live stats: Valid leads, Duplicate removed, Invalid count.
   - Set 2s delay and click **Schedule Emails**.
5. **Watch Live Delivery**:
   - Return to Dashboard: see stat cards update from *Scheduled* $\rightarrow$ *Processing* $\rightarrow$ *Sent*.
   - View Sent Emails table: click **View Inbox** to open the real message on Ethereal Email.
6. **Show Rate Limiting & Auto-Reschedule**:
   - Run `npm run test:reliability` or schedule a campaign exceeding hourly limit: observe the worker reschedule the overflow jobs to the next hour and trigger Slack alerting.
7. **Demonstrate Restart Persistence**:
   - Schedule 5 emails with 30-second delays.
   - Stop the worker process (`Ctrl+C`).
   - Restart the worker process: observe that all delayed jobs fire precisely at their scheduled time without re-starting from scratch or duplicating.

---

## Configuration & Environment Variables

See [`.env.example`](file:///.env.example) for all variables:
- `DATABASE_URL`: PostgreSQL connection string (`localhost:5433`).
- `REDIS_HOST`, `REDIS_PORT`: Redis connection details (`localhost:6380`).
- `ELASTICSEARCH_NODE`: Elasticsearch endpoint (`http://localhost:9200`).
- `WORKER_CONCURRENCY`: Number of concurrent jobs per worker instance (default: `5`).
- `MIN_EMAIL_DELAY_MS`: Minimum delay between sends per sender (default: `2000`).
- `MAX_EMAILS_PER_HOUR`: Maximum emails per hour per sender (default: `100`).
- `DEV_AUTH_BYPASS`: Defaults to `false`; set to `true` only for automated/local testing without Google credentials.

---

## Author & Git Identity
- **Developer**: Vikas Tiwari
- **GitHub**: [Vikas9892](https://github.com/Vikas9892)
- **Email**: [vikast4843@gmail.com](mailto:vikast4843@gmail.com)
- All commits in this repository strictly reflect this single author identity.
