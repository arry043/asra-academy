import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Environment lives in the monorepo root `.env`; an `apps/api/.env` (if present) takes precedence.
loadEnv({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
  quiet: true,
});

/**
 * Migrations and Prisma CLI commands use a *direct* (non-pooled) connection.
 * - Neon (production): DIRECT_DATABASE_URL = direct endpoint, DATABASE_URL = pooled endpoint.
 * - Local Docker: both point at the same PostgreSQL container.
 * Runtime queries use DATABASE_URL through the driver adapter in src/lib/prisma.ts.
 */
const migrationUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
