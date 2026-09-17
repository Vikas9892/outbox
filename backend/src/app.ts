import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/healthRoutes';

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

  // Routes
  app.use(healthRoutes);

  // Root endpoint info
  app.get('/', (_req, res) => {
    res.json({
      name: 'ReachInbox / Outbox Email Scheduler API',
      status: 'active',
      health: '/health',
      documentation: 'https://github.com/Vikas9892/outbox',
    });
  });

  return app;
};

export default createApp;
