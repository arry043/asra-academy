import type { DependencyStatus, HealthData, ReadinessData } from '@asra/types';
import { DEPENDENCY_CHECK_TIMEOUT_MS } from '../config/constants.js';
import { env } from '../config/env.js';
import { pingDatabase } from '../database/prisma.js';
import { logger } from '../lib/logger.js';
import { pingRedis } from '../lib/redis.js';
import { withTimeout } from '../utils/with-timeout.js';

/** Lightweight probes for each dependency. Injectable so readiness can be tested in isolation. */
export interface ReadinessProbes {
  database: () => Promise<unknown>;
  redis: () => Promise<unknown>;
}

const defaultProbes: ReadinessProbes = {
  database: () => pingDatabase(),
  redis: () => pingRedis(),
};

async function probe(name: string, check: () => Promise<unknown>): Promise<DependencyStatus> {
  try {
    await withTimeout(check(), DEPENDENCY_CHECK_TIMEOUT_MS, name);
    return 'up';
  } catch (error) {
    // Logged server-side only; the response carries just 'up' / 'down'.
    logger.warn({ err: error }, `${name} readiness check failed`);
    return 'down';
  }
}

export const healthService = {
  getLiveness(): HealthData {
    return { environment: env.NODE_ENV };
  },

  async getReadiness(probes: ReadinessProbes = defaultProbes): Promise<ReadinessData> {
    const [database, redisStatus] = await Promise.all([
      probe('PostgreSQL', probes.database),
      probe('Redis', probes.redis),
    ]);
    return { environment: env.NODE_ENV, database, redis: redisStatus };
  },
};
