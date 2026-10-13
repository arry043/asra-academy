/**
 * Loaded with `node --import` before any test module, i.e. before src/config/env.ts parses the
 * environment. dotenv never overrides variables that are already set, so these win.
 */
import { randomBytes } from 'node:crypto';
import { resolveTestDatabaseUrl } from './support/test-database.js';

const testDatabaseUrl = resolveTestDatabaseUrl();

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_DATABASE_URL = testDatabaseUrl;

// Deterministic, isolated auth configuration: no real email, per-process rate limits, and a
// throw-away signing key (never the developer's JWT_SECRET).
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.EMAIL_TRANSPORT = 'memory';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.AUTH_COOKIE_SECURE = 'false';
