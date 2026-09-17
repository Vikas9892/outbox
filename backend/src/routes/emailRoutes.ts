import { Router } from 'express';
import {
  getScheduledEmails,
  getSentEmails,
  getEmailStats,
} from '../controllers/emailController';
import { searchEmailsHandler } from '../controllers/searchController';

const router = Router();

router.get('/api/emails/search', searchEmailsHandler);
router.get('/api/emails/scheduled', getScheduledEmails);
router.get('/api/emails/sent', getSentEmails);
router.get('/api/emails/stats', getEmailStats);

export default router;
