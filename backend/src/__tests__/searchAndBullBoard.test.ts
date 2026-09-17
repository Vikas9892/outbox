import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/emailQueue';
import { CampaignService } from '../services/campaignService';
import { initElasticsearchIndex } from '../services/searchService';

describe('Milestone 4: Elasticsearch Search and Bull Board Dashboard', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});
    await emailQueue.drain();
    await initElasticsearchIndex();
  });

  afterAll(async () => {
    await emailQueue.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
  });

  it('should render Bull Board queue dashboard at /admin/queues', async () => {
    const res = await request(app).get('/admin/queues/');

    // Bull Board responds with 200 or 302 redirect to base path
    expect([200, 301, 302]).toContain(res.status);
  });

  it('should search emails across recipient and subject via GET /api/emails/search', async () => {
    // Seed campaign with unique searchable term
    const uniqueTerm = 'QuarterlyReport' + Date.now();
    await CampaignService.createCampaign({
      subject: `Q3 ${uniqueTerm}`,
      body: 'Here is the quarterly summary',
      recipients: [`investor-${Date.now()}@reachinbox.ai`],
      delayMs: 0,
    });

    // Query search endpoint
    const res = await request(app).get(`/api/emails/search?q=${uniqueTerm}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].subject).toContain(uniqueTerm);
    expect(['elasticsearch', 'database_fallback']).toContain(res.body.data[0].source);
  });
});
