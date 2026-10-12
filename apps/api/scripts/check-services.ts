/**
 * Verifies local infrastructure connectivity: `npm run check:services`
 * - PostgreSQL via Prisma (DATABASE_URL)
 * - Redis via ioredis (REDIS_URL)
 */
import { env } from '../src/config/env.js';
import { disconnectPrisma, prisma } from '../src/lib/prisma.js';
import { disconnectRedis, redis } from '../src/lib/redis.js';

function redact(url: string): string {
  const parsed = new URL(url);
  if (parsed.password) parsed.password = '****';
  return parsed.toString();
}

async function checkPostgres(): Promise<boolean> {
  try {
    const [row] = await prisma.$queryRaw<{ version: string }[]>`SELECT version() AS version`;
    console.log(`✔ PostgreSQL  ${redact(env.DATABASE_URL)}`);
    console.log(`  ${row?.version}`);
    return true;
  } catch (error) {
    console.error(`✘ PostgreSQL  ${redact(env.DATABASE_URL)}\n  ${String(error)}`);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    const info = await redis.info('server');
    const version = /redis_version:(\S+)/.exec(info)?.[1] ?? 'unknown';
    console.log(`✔ Redis       ${redact(env.REDIS_URL)}  (PING → ${pong}, v${version})`);
    return true;
  } catch (error) {
    console.error(`✘ Redis       ${redact(env.REDIS_URL)}\n  ${String(error)}`);
    return false;
  }
}

const results = await Promise.all([checkPostgres(), checkRedis()]);
await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);

if (results.every(Boolean)) {
  console.log('\nAll services reachable.');
} else {
  console.error('\nOne or more services are unreachable. Is `docker compose up -d` running?');
  process.exitCode = 1;
}
