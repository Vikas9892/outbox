import { Queue } from 'bullmq';
import { env } from '../config/env';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const redisQueueConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisQueueConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24h
      count: 1000,
    },
    removeOnFail: {
      age: 86400 * 3, // Keep failed jobs for 3 days
    },
  },
});
