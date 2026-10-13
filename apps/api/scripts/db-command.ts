/**
 * Guarded wrapper for Prisma commands that may drop data (`migrate dev`, `migrate reset`).
 *
 *   npm run db:migrate          → prisma migrate dev            (local only)
 *   npm run db:migrate:create   → prisma migrate dev --create-only (local only)
 *   npm run db:reset            → prisma migrate reset, then seed  (local only, destructive)
 *
 * These commands refuse to run unless the migration URL (DIRECT_DATABASE_URL, falling back to
 * DATABASE_URL — the same URL prisma.config.ts uses) points at a local PostgreSQL host and
 * NODE_ENV is not `production`. Neon/staging/production use `npm run db:migrate:deploy`.
 *
 * Extra arguments are forwarded to Prisma, e.g. `npm run db:migrate -- --name add_lessons`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const COMMANDS = {
  'migrate-dev': ['migrate', 'dev'],
  'migrate-create': ['migrate', 'dev', '--create-only'],
  reset: ['migrate', 'reset'],
} as const;

type CommandName = keyof typeof COMMANDS;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

function fail(message: string): never {
  console.error(`\n✘ ${message}\n`);
  process.exit(1);
}

function run(args: readonly string[]): void {
  const result = spawnSync('prisma', args, { stdio: 'inherit' });
  if (result.error) fail(`Could not start Prisma CLI: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const [commandName, ...forwarded] = process.argv.slice(2);
if (!commandName || !(commandName in COMMANDS)) {
  fail(`Usage: db-command.ts <${Object.keys(COMMANDS).join('|')}> [prisma args...]`);
}
const command = commandName as CommandName;

if (process.env.NODE_ENV === 'production') {
  fail(`Refusing to run "${command}" with NODE_ENV=production. Use "npm run db:migrate:deploy".`);
}

const migrationUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!migrationUrl) fail('DATABASE_URL / DIRECT_DATABASE_URL is not set (see .env.example).');

let target: URL;
try {
  target = new URL(migrationUrl);
} catch {
  fail('DATABASE_URL / DIRECT_DATABASE_URL is not a valid URL.');
}

if (!LOCAL_HOSTS.has(target.hostname)) {
  fail(
    `Refusing to run "${command}" against non-local host "${target.hostname}".\n` +
      '  This command can reset data and is restricted to local Docker PostgreSQL.\n' +
      '  For Neon (staging/production) apply committed migrations with "npm run db:migrate:deploy".',
  );
}

const database = target.pathname.replace(/^\//, '') || '(default)';
console.log(`→ ${command} on local database "${database}" at ${target.hostname}:${target.port}`);

run([...COMMANDS[command], ...forwarded]);

// Prisma 7 no longer seeds automatically after a reset; restore a usable dev database explicitly.
if (command === 'reset') run(['db', 'seed']);
