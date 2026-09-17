import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';

export class SlackService {
  /**
   * Generates the Slack OAuth authorize URL.
   */
  static getAuthorizeUrl(): string {
    const scopes = encodeURIComponent('chat:write,chat:write.public');
    const redirectUri = encodeURIComponent(env.SLACK_REDIRECT_URI);
    return `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}`;
  }

  /**
   * Exchanges authorization code for a Slack access token and saves connection.
   */
  static async handleCallback(code: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
        }),
      });

      const data = (await response.json()) as any;

      if (!data.ok) {
        console.error('[SlackService] OAuth token exchange failed:', data.error);
        return false;
      }

      await prisma.slackConnection.upsert({
        where: { userId },
        update: {
          accessToken: data.access_token,
          teamId: data.team?.id || 'unknown',
        },
        create: {
          userId,
          accessToken: data.access_token,
          teamId: data.team?.id || 'unknown',
        },
      });

      console.log(`[SlackService] Successfully connected Slack for user ${userId}`);
      return true;
    } catch (err: any) {
      console.error('[SlackService] Error during OAuth callback:', err.message);
      return false;
    }
  }

  /**
   * Sends a rate limit notification to the user's connected Slack workspace.
   * Deduplicated per hour window in Redis to prevent spamming.
   */
  static async notifyRateLimitHit(
    userId: string,
    senderEmail: string,
    nextWindowDate: Date,
  ): Promise<void> {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
      });

      if (!connection) {
        // User has not connected Slack: gracefully no-op
        return;
      }

      // Deduplicate alert per hour window
      const hourKey = nextWindowDate.toISOString().slice(0, 13);
      const dedupKey = `slack:notified:${userId}:${senderEmail}:${hourKey}`;
      const alreadyNotified = await redisConnection.get(dedupKey);

      if (alreadyNotified) {
        return;
      }

      const messageText = `⚠️ *Email rate limit reached for sender:* \`${senderEmail}\`\nSending will resume in the next available window at *${nextWindowDate.toUTCString()}*.`;

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.accessToken}`,
        },
        body: JSON.stringify({
          channel: '#general', // or default channel
          text: messageText,
        }),
      });

      const resData = (await response.json()) as any;
      if (resData.ok) {
        console.log(`[SlackService] Delivered rate limit alert to Slack for sender ${senderEmail}`);
        // Cache deduplication for 1 hour
        await redisConnection.set(dedupKey, '1', 'EX', 3600);
      } else {
        console.warn(`[SlackService] Slack API error: ${resData.error}`);
      }
    } catch (err: any) {
      // Never crash the worker due to Slack errors
      console.warn(`[SlackService] Could not send Slack notification: ${err.message}`);
    }
  }

  /**
   * Checks whether the user has an active Slack connection.
   */
  static async isConnected(userId: string): Promise<{ connected: boolean; teamId?: string }> {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    return {
      connected: !!connection,
      teamId: connection?.teamId,
    };
  }

  /**
   * Disconnects user's Slack integration.
   */
  static async disconnect(userId: string): Promise<void> {
    await prisma.slackConnection.deleteMany({
      where: { userId },
    });
  }
}

export default SlackService;
