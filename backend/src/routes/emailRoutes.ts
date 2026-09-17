import { Router } from 'express';
import {
  getScheduledEmails,
  getSentEmails,
  getEmailStats,
} from '../controllers/emailController';

const router = Router();

router.get('/api/emails/scheduled', getScheduledEmails);
router.get('/api/emails/sent', getSentEmails);
router.get('/api/emails/stats', getEmailStats);

export default router;
