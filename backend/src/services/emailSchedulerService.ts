import { emailQueue } from '../queues/emailQueue';
import { EmailJobData } from '../types';

export interface EmailToSchedule {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export class EmailSchedulerService {
  /**
   * Schedule a single email with BullMQ delayed job using a deterministic job ID.
   */
  static async scheduleEmail(email: EmailToSchedule): Promise<void> {
    const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
    const jobId = `email-${email.id}`;

    const jobData: EmailJobData = {
      emailId: email.id,
      campaignId: email.campaignId,
      senderId: email.senderId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
    };

    await emailQueue.add('send-email', jobData, {
      jobId,
      delay,
    });

    console.log(
      `[Scheduler] Queued job ${jobId} for ${email.recipient} (delay: ${delay}ms, runAt: ${email.scheduledAt.toISOString()})`,
    );
  }

  /**
   * Schedule multiple emails in bulk with deterministic job IDs.
   */
  static async scheduleBulkEmails(emails: EmailToSchedule[]): Promise<void> {
    const now = Date.now();
    const jobs = emails.map((email) => {
      const delay = Math.max(0, email.scheduledAt.getTime() - now);
      const jobId = `email-${email.id}`;

      return {
        name: 'send-email',
        data: {
          emailId: email.id,
          campaignId: email.campaignId,
          senderId: email.senderId,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
        },
        opts: {
          jobId,
          delay,
        },
      };
    });

    await emailQueue.addBulk(jobs);
    console.log(`[Scheduler] Queued ${jobs.length} emails into BullMQ`);
  }
}

export default EmailSchedulerService;
