import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/healthRoutes';
import campaignRoutes from './routes/campaignRoutes';
import emailRoutes from './routes/emailRoutes';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/emailQueue';

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
