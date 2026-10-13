import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';
import type { Options } from 'express-rate-limit';
import { disconnectPrisma } from '../src/database/prisma.js';
import { redis } from '../src/lib/redis.js';
import { RedisWithMemoryFallbackStore } from '../src/middleware/rate-limit.js';

after(async () => {
  redis.disconnect();
  await disconnectPrisma();
});

async function redisAvailable(): Promise<boolean> {
  try {
    if (redis.status === 'wait') await redis.connect();
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

describe('Redis-backed rate-limit store', () => {
  it('counts in Redis, falls back to memory while Redis is down, and recovers', async (t) => {
    if (!(await redisAvailable())) {
      t.skip('Redis is not running (docker compose up -d)');
      return;
    }
    const prefix = `rl:test:${randomUUID()}:`;
    const store = new RedisWithMemoryFallbackStore(prefix);
    store.init({ windowMs: 60_000 } as Options);

    const first = await store.increment('1.2.3.4');
    const second = await store.increment('1.2.3.4');
    assert.equal(first.totalHits, 1);
    assert.equal(second.totalHits, 2);
    assert.equal(
      await redis.get(`${prefix}1.2.3.4`),
      '2',
      'counter lives in Redis (shared across instances)',
    );

    // Redis goes away: requests are still limited, using the in-process fallback.
    const ended = new Promise((resolve) => redis.once('end', resolve));
    redis.disconnect();
    await ended;
    const degraded = await store.increment('1.2.3.4');
    assert.equal(degraded.totalHits, 1);

    // Redis returns: the store re-initialises and uses Redis again.
    await redis.connect(); // emits 'ready', which re-initialises every Redis-backed store
    store.reinitialisePrimary(); // this store was created outside the module registry
    const recovered = await store.increment('1.2.3.4');
    assert.equal(recovered.totalHits, 3);
    await redis.del(`${prefix}1.2.3.4`);
  });
});
