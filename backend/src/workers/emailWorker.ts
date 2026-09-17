import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, redisQueueConnectionOptions } from '../queues/emailQueue';
import { EmailJobData } from '../types';
import { sendEmail } from '../services/emailService';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

export class EmailWorker {
  private worker: Worker<EmailJobData> | null = null;

  start(): Worker<EmailJobData> {
    if (this.worker) {
      return this.worker;
    }

    console.log(
      `[Worker] Starting Email Worker with concurrency = ${env.WORKER_CONCURRENCY}...`,
    );

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
    const { emailId, senderId, recipient, subject, body } = job.data;

    console.log(`[Worker] Processing email ${emailId} to ${recipient}...`);

    // Fetch sender record
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    const senderEmail = sender?.email || 'noreply@reachinbox.ai';

    try {
      // Send email via Ethereal SMTP
      const result = await sendEmail({
        from: senderEmail,
        to: recipient,
        subject,
        body,
      });

      // Update DB to sent
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });

      console.log(
        `[Worker] Email ${emailId} successfully sent. Ethereal Preview: ${result.previewUrl || 'N/A'}`,
      );
    } catch (err: any) {
      console.error(`[Worker] Error sending email ${emailId}:`, err.message);

      // Record failure attempt in DB
      await prisma.email.update({
        where: { id: emailId },
        data: {
          attempts: { increment: 1 },
          error: err.message || 'Failed to send email',
          status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'scheduled',
        },
      });

      throw err;
    }
  }

  async stop(): Promise<void> {
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
