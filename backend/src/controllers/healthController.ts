import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { redisConnection } from '../config/redis';
import { checkElasticsearchHealth } from '../services/searchService';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  let dbStatus = 'error';
  let redisStatus = 'error';
  let esStatus = 'error';

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message}`;
  }

  // Check Redis
  try {
    const pong = await redisConnection.ping();
    if (pong === 'PONG') {
      redisStatus = 'ok';
    }
  } catch (err: any) {
    redisStatus = `unreachable: ${err.message}`;
  }

  // Check Elasticsearch
  try {
    const isEsHealthy = await checkElasticsearchHealth();
    esStatus = isEsHealthy ? 'ok' : 'degraded';
  } catch (err: any) {
    esStatus = `unreachable: ${err.message}`;
  }

  const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
    },
  });
};
