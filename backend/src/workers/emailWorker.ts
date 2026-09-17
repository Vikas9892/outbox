import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, redisQueueConnectionOptions, emailQueue } from '../queues/emailQueue';
import { EmailJobData } from '../types';
import { sendEmail } from '../services/emailService';
import { RateLimiterService } from '../services/rateLimiterService';
import { RecoveryService } from '../services/recoveryService';
import { indexEmailRecord } from '../services/searchService';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

// Hook for Slack rate limit notifications (wired up in Milestone 5)
type SlackNotifyFn = (userId: string, senderEmail: string, nextWindowDate: Date) => Promise<void>;
let slackNotificationHook: SlackNotifyFn | null = null;

export const setSlackNotificationHook = (fn: SlackNotifyFn) => {
  slackNotificationHook = fn;
};

export class EmailWorker {
  private worker: Worker<EmailJobData> | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;

  start(): Worker<EmailJobData> {
    if (this.worker) {
      return this.worker;
    }

    console.log(
      `[Worker] Starting Email Worker with concurrency = ${env.WORKER_CONCURRENCY}...`,
    );

    // Run crash recovery on worker startup
    RecoveryService.recoverStaleProcessingEmails().catch((err) => {
      console.error('[Worker] Initial crash recovery failed:', err.message);
    });

    // Schedule crash recovery sweeper every 5 minutes
    this.recoveryInterval = setInterval(() => {
      RecoveryService.recoverStaleProcessingEmails().catch((err) => {
        console.error('[Worker] Periodic crash recovery failed:', err.message);
      });
    }, 5 * 60 * 1000);

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        return this.processJob(job);
      },
      {
        connection: redisQueueConnectionOptions,
        concurrency: env.WORKER_CONCURRENCY,
      },
    );

    this.worker.on('completed', (job: Job<EmailJobData>) => {
      console.log(`[Worker] Job ${job.id} completed for ${job.data.recipient}`);
    });

    this.worker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
      console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('error', (err: Error) => {
      console.error('[Worker] Worker internal error:', err.message);
    });

    return this.worker;
  }

  async processJob(job: Job<EmailJobData>): Promise<void> {
    const { emailId, campaignId, senderId, recipient, subject, body } = job.data;

    console.log(`[Worker] Attempting to claim email ${emailId} for ${recipient}...`);

    // 1. IDEMPOTENCY GUARD: Atomic DB Claim
    // Only 1 worker can transition status from 'scheduled' to 'processing'.
    const affectedRows = await prisma.$executeRaw`
      UPDATE emails
      SET status = 'processing', "updatedAt" = NOW()
      WHERE id = ${emailId} AND status = 'scheduled'
    `;

    if (affectedRows === 0) {
      console.log(`[Worker] Email ${emailId} already claimed or processed, skipping job.`);
      return;
    }

    // 2. Fetch campaign and sender details
    const [campaign, sender] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.sender.findUnique({ where: { id: senderId } }),
    ]);

    const senderEmail = sender?.email || 'noreply@reachinbox.ai';
    const hourlyLimit = campaign?.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR;
    const minDelayMs = campaign?.delayMs ?? env.MIN_EMAIL_DELAY_MS;

    // 3. ATOMIC RATE LIMIT CHECK via Redis Lua script
    const rateLimitCheck = await RateLimiterService.checkAndIncrementHourlyLimit(
      senderId,
      hourlyLimit,
    );

    if (!rateLimitCheck.allowed) {
      console.warn(
        `[Worker] Hourly limit (${hourlyLimit}) reached for sender ${senderEmail}. Rescheduling email ${emailId} to ${rateLimitCheck.nextWindowDate.toISOString()}`,
      );

      // Revert DB state back to 'scheduled'
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'scheduled',
          scheduledAt: rateLimitCheck.nextWindowDate,
        },
      });

      // Reschedule BullMQ delayed job to the next hour window
      const rescheduleDelay = Math.max(1000, rateLimitCheck.nextWindowDate.getTime() - Date.now());
      await emailQueue.add('send-email', job.data, {
        jobId: `email-${emailId}-${rateLimitCheck.nextWindowDate.getTime()}`,
        delay: rescheduleDelay,
      });

      // Trigger Slack notification if hook is active
      if (slackNotificationHook && campaign?.userId) {
        slackNotificationHook(campaign.userId, senderEmail, rateLimitCheck.nextWindowDate).catch(
          (err) => console.error('[Worker] Slack notification error:', err.message),
        );
      }

      return;
    }

    // 4. PER-SENDER MINIMUM DELAY ENFORCEMENT
    const delayCheck = await RateLimiterService.checkSenderMinDelay(senderId, minDelayMs);
    if (delayCheck.waitMs > 0) {
      console.log(`[Worker] Enforcing sender minimum delay: waiting ${delayCheck.waitMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayCheck.waitMs));
    }

    // 5. SEND EMAIL VIA ETHEREAL SMTP
    try {
      const result = await sendEmail({
        from: senderEmail,
        to: recipient,
        subject,
        body,
      });

      // 6. UPDATE DB TO 'sent'
      const updated = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });

      // Asynchronously index in Elasticsearch
      indexEmailRecord(updated).catch(() => {});

      console.log(
        `[Worker] Email ${emailId} sent successfully to ${recipient}. Preview: ${result.previewUrl || 'N/A'}`,
      );
    } catch (err: any) {
      console.error(`[Worker] Error sending email ${emailId}:`, err.message);

      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

      await prisma.email.update({
        where: { id: emailId },
        data: {
          attempts: { increment: 1 },
          error: err.message || 'Failed to send email',
          status: isFinalAttempt ? 'failed' : 'scheduled',
        },
      });

      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    if (this.worker) {
      console.log('[Worker] Closing Email Worker...');
      await this.worker.close();
      this.worker = null;
      console.log('[Worker] Email Worker stopped');
    }
  }
}

export const emailWorkerInstance = new EmailWorker();
export default emailWorkerInstance;
