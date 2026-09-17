import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  getMe,
  logout,
  slackAuthorize,
  slackCallback,
  getSlackStatus,
  disconnectSlack,
} from '../controllers/authController';

const router = Router();

// Google OAuth
router.get('/api/auth/google', googleLogin);
router.get('/api/auth/google/callback', googleCallback);
router.get('/api/auth/me', getMe);
router.post('/api/auth/logout', logout);

// Slack OAuth
router.get('/api/auth/slack', slackAuthorize);
router.get('/api/auth/slack/callback', slackCallback);
router.get('/api/auth/slack/status', getSlackStatus);
router.post('/api/auth/slack/disconnect', disconnectSlack);

export default router;
