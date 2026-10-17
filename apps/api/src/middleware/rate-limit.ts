import {
  MemoryStore,
  rateLimit,
  type ClientRateLimitInfo,
  type IncrementResponse,
  type Options,
  type RateLimitRequestHandler,
  type Store,
} from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import {
  ASSESSMENT_RATE_LIMITS,
  AUTH_RATE_LIMITS,
  type AssessmentRateLimitName,
  type AuthRateLimitName,
} from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { sendError } from '../utils/api-response.js';

/**
 * Redis-backed store (shared by all API instances) that degrades to the library's in-process
 * MemoryStore while Redis is unavailable, instead of either disabling rate limiting (fail-open)
 * or rejecting every login (fail-closed). When ioredis reconnects, the Redis store is
 * re-initialised: rate-limit-redis caches its Lua script SHA, and a failed load at boot would
 * otherwise never recover.
 */
export class RedisWithMemoryFallbackStore implements Store {
  readonly localKeys = false;
  private options?: Options;
  private warned = false;

  constructor(
    readonly prefix: string,
    private readonly primary = new RedisStore({
      prefix,
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<RedisReply>,
    }),
    private readonly fallback = new MemoryStore(),
  ) {}

  init(options: Options): void {
    this.options = options;
    this.fallback.init(options);
    this.reinitialisePrimary();
  }

  reinitialisePrimary(): void {
    if (!this.options) return;
    this.primary.init(this.options).catch(() => {
      // Expected while Redis is down; `increment` falls back to memory and warns once.
    });
  }

  private async withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T> | T) {
    try {
      const result = await primary();
      this.warned = false;
      return result;
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        logger.warn({ err: error, prefix: this.prefix }, 'Rate limiter using in-memory fallback');
      }
      return fallback();
    }
  }

  increment(key: string): Promise<IncrementResponse> {
    return this.withFallback(
      () => this.primary.increment(key),
      () => this.fallback.increment(key),
    );
  }

  get(key: string): Promise<ClientRateLimitInfo | undefined> {
    return this.withFallback(
      () => this.primary.get(key),
      () => this.fallback.get(key),
    );
  }

  async decrement(key: string): Promise<void> {
    await this.withFallback(
      () => this.primary.decrement(key),
      () => this.fallback.decrement(key),
    );
  }

  async resetKey(key: string): Promise<void> {
    await Promise.allSettled([this.primary.resetKey(key), this.fallback.resetKey(key)]);
  }

  async resetAll(): Promise<void> {
    // RedisStore has no resetAll (keys may be shared); only the local fallback can be cleared.
    await this.fallback.resetAll();
  }
}

const stores: Store[] = [];
const redisStores: RedisWithMemoryFallbackStore[] = [];

redis.on('ready', () => redisStores.forEach((store) => store.reinitialisePrimary()));

function createStore(name: string, scope = 'auth'): Store {
  if (env.RATE_LIMIT_STORE === 'memory') {
    const store = new MemoryStore();
    stores.push(store);
    return store;
  }
  const store = new RedisWithMemoryFallbackStore(`rl:${scope}:${name}:`);
  stores.push(store);
  redisStores.push(store);
  return store;
}

/**
 * A per-IP limiter for one auth endpoint. Over the limit → 429 RATE_LIMITED in the standard
 * envelope with `RateLimit-*` and `Retry-After` headers. Each call creates its own store.
 */
export function authRateLimit(name: AuthRateLimitName): RateLimitRequestHandler {
  const config = AUTH_RATE_LIMITS[name];
  return rateLimit({
    windowMs: config.windowMinutes * 60 * 1000,
    limit: config.limit,
    skipSuccessfulRequests: 'skipSuccessfulRequests' in config && config.skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: createStore(name),
    passOnStoreError: true,
    logger: {
      error: (error: unknown, message?: string) => logger.error({ err: error }, message),
      warn: (error: unknown, message?: string) => logger.warn({ err: error }, message),
    },
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again later.');
    },
  });
}

/**
 * A per-USER limiter for authenticated assessment endpoints (PHASE 09). Must run after
 * `authenticate`; keyed by the account id so students behind one school NAT do not share a quota.
 */
export function assessmentRateLimit(name: AssessmentRateLimitName): RateLimitRequestHandler {
  const config = ASSESSMENT_RATE_LIMITS[name];
  return rateLimit({
    windowMs: config.windowMinutes * 60 * 1000,
    limit: config.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.auth?.userId ?? 'anonymous'}`,
    store: createStore(name, 'assessment'),
    passOnStoreError: true,
    logger: {
      error: (error: unknown, message?: string) => logger.error({ err: error }, message),
      warn: (error: unknown, message?: string) => logger.warn({ err: error }, message),
    },
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
    },
  });
}

/** Clears every limiter's local counters. For automated tests only. */
export async function resetRateLimits(): Promise<void> {
  await Promise.all(stores.map((store) => store.resetAll?.()));
}
