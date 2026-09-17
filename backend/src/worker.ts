import { emailWorkerInstance } from './workers/emailWorker';
import { env } from './config/env';

console.log('----------------------------------------------------');
console.log('         ReachInbox / Outbox Email Worker           ');
console.log(` Concurrency: ${env.WORKER_CONCURRENCY}`);
console.log(` Redis Host:  ${env.REDIS_HOST}:${env.REDIS_PORT}`);
console.log('----------------------------------------------------');

const worker = emailWorkerInstance.start();

const shutdown = async () => {
  console.log('[Worker Process] Received termination signal, shutting down...');
  await emailWorkerInstance.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
