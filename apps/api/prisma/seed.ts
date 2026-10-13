/**
 * Database seed entry point (`npm run db:seed`, also run by `npm run db:reset`).
 *
 * Seeds ONLY foundational reference data and is safe to run repeatedly:
 *   - system roles: SUPER_ADMIN, ADMIN, FACULTY, STUDENT
 *   - the initial permission catalogue and role → permission grants
 *
 * It deliberately creates NO user accounts (no default admin, no passwords) and NO academic
 * catalogue (classes, subjects, courses): the final lists are pending client confirmation
 * (docs/CLIENT-CLARIFICATIONS.md §A–C). See docs/DATABASE.md §Seed.
 */
import { seedAccessControl } from '../src/database/seed/access-control.seed.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';

async function main(): Promise<void> {
  const [row] = await prisma.$queryRaw<{ database: string }[]>`
    SELECT current_database() AS database
  `;
  console.log(`[seed] Seeding database "${row?.database}"`);

  const result = await seedAccessControl(prisma);
  console.log(
    `[seed] Roles: ${result.roles} · Permissions: ${result.permissions} · ` +
      `New role grants: ${result.grantsAdded}`,
  );
  console.log('[seed] Done.');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
