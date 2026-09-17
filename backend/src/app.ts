import express, { Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import { env } from './config/env';
import healthRoutes from './routes/healthRoutes';
import campaignRoutes from './routes/campaignRoutes';
import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/emailQueue';
import { SlackService } from './services/slackService';
import { setSlackNotificationHook } from './workers/emailWorker';

// Connect Slack rate limit notification hook to worker
setSlackNotificationHook(SlackService.notifyRateLimitHit);

export const createApp = () => {
  const app = express();

  // Basic Middleware
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session Middleware
  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  // Bull Board Queue Dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  // Routes
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(campaignRoutes);
  app.use(emailRoutes);

  // Root endpoint info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'ReachInbox / Outbox Email Scheduler API',
      status: 'active',
      health: '/health',
      queues: '/admin/queues',
      documentation: 'https://github.com/Vikas9892/outbox',
    });
  });

  return app;
};

export default createApp;
