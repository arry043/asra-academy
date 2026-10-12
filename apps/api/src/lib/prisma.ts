import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Single PrismaClient for the process. Uses DATABASE_URL — on Neon this is the pooled
 * connection string; locally it points to the Docker PostgreSQL container.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: env.isDevelopment ? ['warn', 'error'] : ['error'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
