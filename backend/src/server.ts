import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[API Server] Running on http://localhost:${env.PORT}`);
  console.log(`[API Server] Environment: ${env.NODE_ENV}`);
  console.log(`[API Server] Health check available at http://localhost:${env.PORT}/health`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[API Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[API Server] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
