import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { esClient } from '../services/searchService';

describe('Health Check Endpoint', () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
    redisConnection.disconnect();
    await esClient.close();
  });

  it('GET /health should return 200 and report ok for database and redis', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body.services).toHaveProperty('database', 'ok');
    expect(response.body.services).toHaveProperty('redis', 'ok');
  });

  it('GET / should return root API metadata', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('status', 'active');
  });
});
