import path from 'node:path';
import { config as loadEnv } from 'dotenv';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

/**
 * Resolves the database used by the automated tests.
 *
 * TEST_DATABASE_URL if set, otherwise DATABASE_URL with `_test` appended to the database name
 * (e.g. asra_academy → asra_academy_test on the same Docker PostgreSQL). Tests write and delete
 * rows, so the URL must point at a local host AND a database whose name ends in `_test` —
 * anything else (Neon, the dev database) is refused.
 */
export function resolveTestDatabaseUrl(): string {
  loadEnv({
    path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
    quiet: true,
  });

  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit || process.env.DATABASE_URL;
  if (!base) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run the database tests.');

  const url = new URL(base);
  if (!explicit) url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;

  const database = url.pathname.replace(/^\//, '');
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to run tests against non-local database host "${url.hostname}".`);
  }
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${database}": name must end with "_test".`);
  }
  return url.toString();
}
