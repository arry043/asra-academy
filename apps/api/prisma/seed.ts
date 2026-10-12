/**
 * Database seed entry point (`npm run db:seed`).
 *
 * PHASE 01: there are no domain models yet, so this only verifies that Prisma can reach
 * PostgreSQL. Reference data (roles, sample academic structure) is added in PHASE 02+.
 */
import { disconnectPrisma, prisma } from '../src/lib/prisma.js';

async function main(): Promise<void> {
  const [row] = await prisma.$queryRaw<{ database: string; version: string }[]>`
    SELECT current_database() AS database, version() AS version
  `;
  console.log(`[seed] Connected to database "${row?.database}"`);
  console.log(`[seed] ${row?.version}`);
  console.log('[seed] No seed data in Phase 01 (no domain models yet).');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
