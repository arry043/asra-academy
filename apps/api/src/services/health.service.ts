import type { DependencyStatus, HealthData, ReadinessData } from '@asra/types';
import { DEPENDENCY_CHECK_TIMEOUT_MS } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { withTimeout } from '../utils/with-timeout.js';

async function probe(name: string, check: () => Promise<unknown>): Promise<DependencyStatus> {
  try {
    await withTimeout(check(), DEPENDENCY_CHECK_TIMEOUT_MS, name);
    return 'up';
  } catch (error) {
    logger.warn({ err: error }, `${name} readiness check failed`);
    return 'down';
  }
}

export const healthService = {
  getLiveness(): HealthData {
    return { environment: env.NODE_ENV };
  },

  async getReadiness(): Promise<ReadinessData> {
    const [database, redisStatus] = await Promise.all([
      probe('PostgreSQL', () => prisma.$queryRaw`SELECT 1`),
      probe('Redis', () => redis.ping()),
    ]);
    return { environment: env.NODE_ENV, database, redis: redisStatus };
  },
};
