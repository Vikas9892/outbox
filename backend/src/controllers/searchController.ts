import { Request, Response } from 'express';
import { searchEmails } from '../services/searchService';

export const searchEmailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';
    const results = await searchEmails(query);

    res.json({
      success: true,
      query,
      count: results.length,
      data: results,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to execute search',
    });
  }
};
