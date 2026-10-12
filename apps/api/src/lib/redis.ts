import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Shared Redis connection. PHASE 01 only verifies connectivity; BullMQ queues, caching and
 * rate-limit stores build on this in later phases.
 *
 * `lazyConnect` keeps the API bootable when Redis is unavailable — Redis is not yet on the
 * critical path, and readiness is reported through `GET /api/v1/health/ready`.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
});

let lastErrorLoggedAt = 0;
redis.on('error', (error) => {
  // Avoid flooding logs while Redis is down and ioredis keeps retrying.
  const now = Date.now();
  if (now - lastErrorLoggedAt > 30_000) {
    lastErrorLoggedAt = now;
    logger.warn({ err: error }, 'Redis connection error');
  }
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (error) {
    logger.warn({ err: error }, 'Redis unavailable at startup; will keep retrying');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'end') return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
