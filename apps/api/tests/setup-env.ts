/**
 * Loaded with `node --import` before any test module, i.e. before src/config/env.ts parses the
 * environment. dotenv never overrides variables that are already set, so these win.
 */
import { resolveTestDatabaseUrl } from './support/test-database.js';

const testDatabaseUrl = resolveTestDatabaseUrl();

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_DATABASE_URL = testDatabaseUrl;
