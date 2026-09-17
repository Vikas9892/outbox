import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/emailQueue';
import { emailWorkerInstance } from '../workers/emailWorker';

describe('Milestone 2: Scheduling, BullMQ, and Email Worker', () => {
  const app = createApp();

  beforeAll(async () => {
    // Clean up test emails and campaigns
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});
    await emailQueue.drain();
  });

  afterAll(async () => {
    await emailWorkerInstance.stop();
    await emailQueue.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
  });

  it('should create a campaign, generate email records, and queue BullMQ delayed jobs', async () => {
    const payload = {
      subject: 'Outbox Launch Update',
      body: 'Hello from Outbox Labs email scheduler!',
      recipients: ['alice@example.com', 'bob@example.com'],
      delayMs: 200,
    };

    const res = await request(app).post('/api/campaigns').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalEmails).toBe(2);

    const campaignId = res.body.data.campaign.id;

    // Verify emails were saved in PostgreSQL with status 'scheduled'
    const dbEmails = await prisma.email.findMany({
      where: { campaignId },
      orderBy: { scheduledAt: 'asc' },
    });

    expect(dbEmails.length).toBe(2);
    expect(dbEmails[0].status).toBe('scheduled');
    expect(dbEmails[1].status).toBe('scheduled');
    expect(dbEmails[0].recipient).toBe('alice@example.com');
    expect(dbEmails[1].recipient).toBe('bob@example.com');

    // Verify BullMQ has delayed/waiting jobs
    const jobs = await emailQueue.getJobs(['delayed', 'waiting']);
    const scheduledJobIds = jobs.map((j) => j.id);

    expect(scheduledJobIds).toContain(`email-${dbEmails[0].id}`);
    expect(scheduledJobIds).toContain(`email-${dbEmails[1].id}`);

    // Process the jobs using email worker
    const job1 = jobs.find((j) => j.id === `email-${dbEmails[0].id}`);
    const job2 = jobs.find((j) => j.id === `email-${dbEmails[1].id}`);

    expect(job1).toBeDefined();
    expect(job2).toBeDefined();

    if (job1 && job2) {
      await emailWorkerInstance.processJob(job1);
      await emailWorkerInstance.processJob(job2);
    }

    // Verify DB records updated to 'sent'
    const updatedEmails = await prisma.email.findMany({
      where: { campaignId },
    });

    expect(updatedEmails[0].status).toBe('sent');
    expect(updatedEmails[0].sentAt).toBeInstanceOf(Date);
    expect(updatedEmails[1].status).toBe('sent');
    expect(updatedEmails[1].sentAt).toBeInstanceOf(Date);

    // Verify GET /api/emails/stats reports 2 sent
    const statsRes = await request(app).get('/api/emails/stats');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.sent).toBe(2);
    expect(statsRes.body.data.scheduled).toBe(0);
  }, 30000);
});
