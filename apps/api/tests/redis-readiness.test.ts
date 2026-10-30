import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Redis } from 'ioredis';
import { env } from '../src/config/env.js';
import { createRedisClient, pingRedis } from '../src/lib/redis.js';

/**
 * INC-2026-001 (docs/PRODUCTION-INCIDENT-LOG.md): on Vercel `server.ts` never runs, so nothing
 * opens the Redis connection up front. The first readiness check of a new function instance was
 * refused by ioredis (`enableOfflineQueue: false`) and reported Redis as down.
 */
describe('pingRedis on a client that has not finished connecting', () => {
  const clients: Redis[] = [];
  let redisAvailable = false;

  function newClient(url = env.REDIS_URL): Redis {
    const client = createRedisClient(url);
    client.on('error', () => undefined);
    clients.push(client);
    return client;
  }

  before(async () => {
    const probe = newClient();
    redisAvailable = await probe.connect().then(
      () => true,
      () => false,
    );
    probe.disconnect();
  });

  after(() => {
    clients.forEach((client) => client.disconnect());
  });

  it('a bare PING on a new client is refused, which is why pingRedis exists', async (t) => {
    if (!redisAvailable) return t.skip('Redis is not running');
    const client = newClient();
    assert.equal(client.status, 'wait');
    await assert.rejects(client.ping(), /enableOfflineQueue/);
  });

  it('connects a client nobody has started, then pings', async (t) => {
    if (!redisAvailable) return t.skip('Redis is not running');
    const client = newClient();
    assert.equal(client.status, 'wait');
    await pingRedis(client);
    assert.equal(client.status, 'ready');
  });

  it('waits for a connection already being opened (rate-limit stores start one on import)', async (t) => {
    if (!redisAvailable) return t.skip('Redis is not running');
    const client = newClient();
    void client.connect();
    assert.equal(client.status, 'connecting');
    await pingRedis(client);
    assert.equal(client.status, 'ready');
  });

  it('pings a client that is already connected', async (t) => {
    if (!redisAvailable) return t.skip('Redis is not running');
    const client = newClient();
    await client.connect();
    await pingRedis(client);
  });

  it('still fails when Redis is unreachable, and repeated checks add no listeners', async () => {
    // Port 1 is reserved and refuses connections, so the outage path needs no running Redis.
    const client = newClient('redis://127.0.0.1:1');
    await assert.rejects(pingRedis(client));
    // Baseline after the first call: ioredis's connect() keeps a 'ready' listener of its own.
    const baseline = client.listenerCount('ready');
    for (let check = 0; check < 3; check++) await assert.rejects(pingRedis(client));
    assert.ok(client.listenerCount('ready') <= baseline);
  });
});
