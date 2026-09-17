import { Request, Response } from 'express';
import { z } from 'zod';
import { CampaignService } from '../services/campaignService';

const createCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string()).optional(),
  delayMs: z.number().int().min(0).optional(),
  hourlyLimit: z.number().int().min(1).optional(),
  senderEmail: z.string().email().optional(),
});

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createCampaignSchema.parse(req.body);

    const result = await CampaignService.createCampaign({
      ...validatedData,
      userId: (req as any).user?.id,
    });

    res.status(201).json({
      success: true,
      message: `Successfully scheduled campaign with ${result.totalEmails} email(s)`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: err.message || 'Failed to create campaign',
    });
  }
};

export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const campaigns = await CampaignService.getCampaigns(userId);

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch campaigns',
    });
  }
};
