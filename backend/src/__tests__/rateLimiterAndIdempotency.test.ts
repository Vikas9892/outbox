import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/emailQueue';
import { emailWorkerInstance } from '../workers/emailWorker';
import { RateLimiterService } from '../services/rateLimiterService';
import { RecoveryService } from '../services/recoveryService';
import { CampaignService } from '../services/campaignService';

describe('Milestone 3: Idempotency, Rate Limiting, and Rescheduling', () => {
  let defaultUser: any;
  let defaultSender: any;

  beforeAll(async () => {
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});
    await emailQueue.drain();

    const setup = await CampaignService.getOrCreateDefaultUserAndSender();
    defaultUser = setup.user;
    defaultSender = setup.sender;
  });

  afterAll(async () => {
    await emailWorkerInstance.stop();
    await emailQueue.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
  });

  it('should atomically allow only 1 worker to claim an email (Idempotency)', async () => {
    // Create a single campaign and email
    const campaign = await prisma.campaign.create({
      data: {
        userId: defaultUser.id,
        subject: 'Idempotency Test',
        body: 'Testing claim race condition',
        startTime: new Date(),
        delayMs: 0,
        hourlyLimit: 100,
      },
    });

    const email = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: defaultSender.id,
        recipient: 'idempotent@example.com',
        subject: 'Idempotency Test',
        body: 'Testing claim race condition',
        scheduledAt: new Date(),
        status: 'scheduled',
      },
    });

    // Worker 1 claims the email atomically
    const claim1 = await prisma.$executeRaw`
      UPDATE emails
      SET status = 'processing', "updatedAt" = NOW()
      WHERE id = ${email.id} AND status = 'scheduled'
    `;

    // Worker 2 attempts to claim the exact same email simultaneously
    const claim2 = await prisma.$executeRaw`
      UPDATE emails
      SET status = 'processing', "updatedAt" = NOW()
      WHERE id = ${email.id} AND status = 'scheduled'
    `;

    expect(claim1).toBe(1); // Worker 1 successfully claimed
    expect(claim2).toBe(0); // Worker 2 blocked because status is no longer 'scheduled'
  });

  it('should enforce hourly rate limit atomically using Redis Lua script', async () => {
    const testSenderId = 'test-sender-' + Date.now();
    const limit = 2;

    // Send 1: should be allowed
    const check1 = await RateLimiterService.checkAndIncrementHourlyLimit(testSenderId, limit);
    expect(check1.allowed).toBe(true);

    // Send 2: should be allowed
    const check2 = await RateLimiterService.checkAndIncrementHourlyLimit(testSenderId, limit);
    expect(check2.allowed).toBe(true);

    // Send 3: exceeds limit of 2, must be rejected
    const check3 = await RateLimiterService.checkAndIncrementHourlyLimit(testSenderId, limit);
    expect(check3.allowed).toBe(false);
    expect(check3.nextWindowDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should reschedule job and keep email as scheduled when rate limit is exceeded', async () => {
    const testSenderId = 'reschedule-sender-' + Date.now();

    // Fill rate limit bucket with limit = 1
    await RateLimiterService.checkAndIncrementHourlyLimit(testSenderId, 1);

    const sender = await prisma.sender.create({
      data: {
        id: testSenderId,
        userId: defaultUser.id,
        email: `sender-${Date.now()}@reachinbox.ai`,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        userId: defaultUser.id,
        subject: 'Rate Limit Reschedule Test',
        body: 'Body',
        startTime: new Date(),
        delayMs: 0,
        hourlyLimit: 1, // Limit is 1
      },
    });

    const email = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'rescheduled@example.com',
        subject: 'Rate Limit Reschedule Test',
        body: 'Body',
        scheduledAt: new Date(),
        status: 'scheduled',
      },
    });

    const mockJob: any = {
      id: `email-${email.id}`,
      data: {
        emailId: email.id,
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      },
      opts: { attempts: 3 },
      attemptsMade: 0,
    };

    // Process job through worker
    await emailWorkerInstance.processJob(mockJob);

    // Verify email status was reverted to 'scheduled' (not 'failed')
    const updatedEmail = await prisma.email.findUnique({
      where: { id: email.id },
    });

    expect(updatedEmail?.status).toBe('scheduled');
    expect(updatedEmail?.scheduledAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should recover stale processing emails on crash recovery', async () => {
    const campaign = await prisma.campaign.create({
      data: {
        userId: defaultUser.id,
        subject: 'Crash Recovery Test',
        body: 'Simulating crash',
        startTime: new Date(),
        delayMs: 0,
        hourlyLimit: 100,
      },
    });

    // Create an email stuck in 'processing' 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleEmail = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: defaultSender.id,
        recipient: 'crashed@example.com',
        subject: 'Crash Recovery Test',
        body: 'Simulating crash',
        scheduledAt: tenMinutesAgo,
        status: 'processing',
        updatedAt: tenMinutesAgo,
      },
    });

    // Run recovery sweeper
    const recoveredCount = await RecoveryService.recoverStaleProcessingEmails(5);

    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const recoveredEmail = await prisma.email.findUnique({
      where: { id: staleEmail.id },
    });

    expect(recoveredEmail?.status).toBe('scheduled');
  });
});
