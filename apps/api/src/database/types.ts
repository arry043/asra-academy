import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

/**
 * Either the shared client or an interactive-transaction client. Repositories accept this so
 * services can compose several repository calls inside one `prisma.$transaction(...)`.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;
