import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 30_000;

/**
 * Builds a PrismaClient backed by a `pg` connection pool (Prisma 7 driver adapter).
 *
 * The application uses the shared `prisma` instance below; this factory exists for tooling and
 * tests that must target a different database explicitly. Never create clients per request.
 */
export function createPrismaClient(connectionString: string = env.DATABASE_URL): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });

  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

/**
 * The single PrismaClient for this process. It uses DATABASE_URL — on Neon the *pooled*
 * connection string; locally the Docker PostgreSQL container.
 *
 * `tsx watch` restarts the whole process on change, so no globalThis caching is needed to
 * avoid duplicate clients during development.
 */
export const prisma = createPrismaClient();

/** Runs a trivial query to prove the database is reachable. Throws on failure. */
export async function pingDatabase(client: PrismaClient = prisma): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}

/** Closes the pool. Safe to call more than once. */
export async function disconnectPrisma(client: PrismaClient = prisma): Promise<void> {
  await client.$disconnect();
}
