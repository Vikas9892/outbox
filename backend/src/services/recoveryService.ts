import { prisma } from '../db/prisma';
import { emailQueue } from '../queues/emailQueue';
import { EmailJobData } from '../types';

export class RecoveryService {
  /**
   * Sweeps emails stuck in 'processing' status for more than thresholdMinutes (e.g. 5 minutes).
   * Resets them back to 'scheduled' and re-queues them into BullMQ.
   */
  static async recoverStaleProcessingEmails(thresholdMinutes: number = 5): Promise<number> {
    const staleThreshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const staleEmails = await prisma.email.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: staleThreshold,
        },
      },
    });

    if (staleEmails.length === 0) {
      return 0;
    }

    console.log(`[RecoveryService] Found ${staleEmails.length} stale processing email(s). Recovering...`);

    let recoveredCount = 0;
    for (const email of staleEmails) {
      // Reset back to scheduled
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'scheduled',
          updatedAt: new Date(),
        },
      });

      // Re-queue into BullMQ
      const jobData: EmailJobData = {
        emailId: email.id,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      };

      await emailQueue.add('send-email', jobData, {
        jobId: `email-${email.id}-recovered-${Date.now()}`,
        delay: 1000,
      });

      recoveredCount++;
    }

    console.log(`[RecoveryService] Successfully recovered and re-queued ${recoveredCount} email(s)`);
    return recoveredCount;
  }
}

export default RecoveryService;
