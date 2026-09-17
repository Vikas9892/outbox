import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { CreateCampaignDTO } from '../types';
import { EmailSchedulerService, EmailToSchedule } from './emailSchedulerService';
import { getEtherealCredentials } from './emailService';
import { indexEmailRecord } from './searchService';

export class CampaignService {
  /**
   * Helper to ensure a default user and sender exist (for local demo and API testing).
   */
  static async getOrCreateDefaultUserAndSender(userId?: string, senderEmail?: string) {
    let user;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }

    if (!user) {
      // Find or create default demo user
      user = await prisma.user.upsert({
        where: { email: 'vikast4843@gmail.com' },
        update: {},
        create: {
          name: 'Vikas Tiwari',
          email: 'vikast4843@gmail.com',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9892?v=4',
        },
      });
    }

    const etherealCreds = await getEtherealCredentials();
    const effectiveSenderEmail = senderEmail || etherealCreds?.user || user.email;

    let sender = await prisma.sender.findFirst({
      where: { userId: user.id, email: effectiveSenderEmail },
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          userId: user.id,
          email: effectiveSenderEmail,
          etherealUser: etherealCreds?.user,
          etherealPassword: etherealCreds?.pass,
        },
      });
    }

    return { user, sender };
  }

  /**
   * Create campaign, generate email records with staggered scheduling, and queue BullMQ jobs.
   */
  static async createCampaign(dto: CreateCampaignDTO) {
    const { user, sender } = await this.getOrCreateDefaultUserAndSender(
      dto.userId,
      dto.senderEmail,
    );

    const delayMs = dto.delayMs !== undefined ? dto.delayMs : env.MIN_EMAIL_DELAY_MS;
    const hourlyLimit = dto.hourlyLimit !== undefined ? dto.hourlyLimit : env.MAX_EMAILS_PER_HOUR;

    const baseStartTime = dto.startTime ? new Date(dto.startTime) : new Date();
    const startTime = baseStartTime.getTime() < Date.now() ? new Date() : baseStartTime;

    // Filter duplicate and empty recipients
    const uniqueRecipients = Array.from(
      new Set(dto.recipients.map((r) => r.trim().toLowerCase()).filter((r) => r.length > 0)),
    );

    if (uniqueRecipients.length === 0) {
      throw new Error('At least one valid recipient is required');
    }

    // 1. Create Campaign in DB
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        subject: dto.subject,
        body: dto.body,
        startTime,
        delayMs,
        hourlyLimit,
      },
    });

    // 2. Prepare Email records with staggered scheduledAt times
    const emailsToCreate = uniqueRecipients.map((recipient, index) => {
      const scheduledAt = new Date(startTime.getTime() + index * delayMs);
      return {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient,
        subject: dto.subject,
        body: dto.body,
        scheduledAt,
        status: 'scheduled' as const,
      };
    });

    // 3. Insert emails in DB
    await prisma.email.createMany({
      data: emailsToCreate,
    });

    // Fetch the created emails with their generated IDs
    const createdEmails = await prisma.email.findMany({
      where: { campaignId: campaign.id },
      orderBy: { scheduledAt: 'asc' },
    });

    // 4. Queue delayed BullMQ jobs
    const emailsToSchedule: EmailToSchedule[] = createdEmails.map((e) => ({
      id: e.id,
      campaignId: e.campaignId,
      senderId: e.senderId,
      recipient: e.recipient,
      subject: e.subject,
      body: e.body,
      scheduledAt: e.scheduledAt,
    }));

    await EmailSchedulerService.scheduleBulkEmails(emailsToSchedule);

    // Asynchronously index in Elasticsearch (non-blocking)
    createdEmails.forEach((e) => {
      indexEmailRecord(e).catch(() => {});
    });

    return {
      campaign,
      totalEmails: createdEmails.length,
      firstScheduledAt: createdEmails[0]?.scheduledAt,
      lastScheduledAt: createdEmails[createdEmails.length - 1]?.scheduledAt,
    };
  }

  /**
   * Get all campaigns with email status counts.
   */
  static async getCampaigns(userId?: string) {
    const campaigns = await prisma.campaign.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        emails: {
          select: {
            status: true,
          },
        },
      },
    });

    return campaigns.map((campaign) => {
      const counts = {
        total: campaign.emails.length,
        scheduled: 0,
        processing: 0,
        sent: 0,
        failed: 0,
      };

      for (const email of campaign.emails) {
        if (email.status === 'scheduled') counts.scheduled++;
        else if (email.status === 'processing') counts.processing++;
        else if (email.status === 'sent') counts.sent++;
        else if (email.status === 'failed') counts.failed++;
      }

      const { emails: _, ...campaignData } = campaign;
      return {
        ...campaignData,
        counts,
        progressPercent:
          counts.total > 0 ? Math.round(((counts.sent + counts.failed) / counts.total) * 100) : 0,
      };
    });
  }
}

export default CampaignService;
