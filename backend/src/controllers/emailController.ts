import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

export const getScheduledEmails = async (_req: Request, res: Response): Promise<void> => {
  try {
    const emails = await prisma.email.findMany({
      where: {
        status: 'scheduled',
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        sender: {
          select: { email: true },
        },
      },
    });

    res.json({
      success: true,
      data: emails,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch scheduled emails',
    });
  }
};

export const getSentEmails = async (_req: Request, res: Response): Promise<void> => {
  try {
    const emails = await prisma.email.findMany({
      where: {
        status: { in: ['sent', 'failed'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        sender: {
          select: { email: true },
        },
      },
    });

    res.json({
      success: true,
      data: emails,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch sent emails',
    });
  }
};

export const getEmailStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [scheduled, processing, sent, failed] = await Promise.all([
      prisma.email.count({ where: { status: 'scheduled' } }),
      prisma.email.count({ where: { status: 'processing' } }),
      prisma.email.count({ where: { status: 'sent' } }),
      prisma.email.count({ where: { status: 'failed' } }),
    ]);

    const total = scheduled + processing + sent + failed;

    res.json({
      success: true,
      data: {
        scheduled,
        processing,
        sent,
        failed,
        total,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch email statistics',
    });
  }
};
