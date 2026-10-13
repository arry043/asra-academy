/**
 * Prepares the local test database (`npm run test:db:prepare`, run automatically by `npm test`):
 * creates it if missing and applies the committed migrations with `prisma migrate deploy` —
 * the same non-destructive command used for Neon. Never resets data.
 */
import { spawnSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from '../tests/support/test-database.js';

const url = resolveTestDatabaseUrl();
const database = new URL(url).pathname.slice(1);
console.log(`→ Applying migrations to test database "${database}"`);

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  // prisma.config.ts prefers DIRECT_DATABASE_URL, so override both.
  env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
});

if (result.error) {
  console.error(`Could not start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
