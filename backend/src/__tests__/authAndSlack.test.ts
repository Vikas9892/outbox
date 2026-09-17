import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/emailQueue';
import { SlackService } from '../services/slackService';
import { AuthService } from '../services/authService';

describe('Milestone 5: Google Auth and Slack Notifications', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.slackConnection.deleteMany({});
  });

  afterAll(async () => {
    await emailQueue.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
  });

  it('GET /api/auth/me should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.user).toBeNull();
  });

  it('GET /api/auth/slack/status should return connected: false when disconnected', async () => {
    const res = await request(app).get('/api/auth/slack/status');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('SlackService.notifyRateLimitHit should not crash if Slack is not connected', async () => {
    const fakeUserId = 'user-without-slack-' + Date.now();
    await expect(
      SlackService.notifyRateLimitHit(fakeUserId, 'sender@reachinbox.ai', new Date()),
    ).resolves.not.toThrow();
  });

  it('AuthService.getGoogleAuthUrl should return valid Google OAuth URL', () => {
    const url = AuthService.getGoogleAuthUrl();
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id');
  });

  it('SlackService.getAuthorizeUrl should return valid Slack OAuth URL', () => {
    const url = SlackService.getAuthorizeUrl();
    expect(url).toContain('https://slack.com/oauth/v2/authorize');
    expect(url).toContain('client_id');
  });
});
