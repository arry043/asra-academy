import path from 'node:path';
import { appEnvironmentSchema } from '@asra/validation';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Local development reads the monorepo root `.env`. In hosted environments variables come
// from the platform and these files simply do not exist.
loadEnv({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

/** Treats `VAR=` (empty) in .env files the same as an unset variable. */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** Integer setting with a default; empty values fall back to the default. */
const intSetting = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => emptyToUndefined(value) ?? String(fallback),
    z.coerce.number().int().min(min).max(max),
  );

/** Boolean setting accepting true/false/1/0; empty or unset → undefined. */
const boolSetting = z.preprocess(
  emptyToUndefined,
  z
    .enum(['true', 'false', '1', '0'])
    .transform((value) => value === 'true' || value === '1')
    .optional(),
);

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

const envSchema = z
  .object({
    NODE_ENV: appEnvironmentSchema.default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // Runtime connection (Neon: pooled endpoint; local: Docker PostgreSQL).
    DATABASE_URL: postgresUrl,
    // Prisma CLI / migrations only (Neon: direct endpoint). Not used by the running API, but
    // validated when present so a malformed value is caught early.
    DIRECT_DATABASE_URL: z.preprocess(emptyToUndefined, postgresUrl.optional()),
    // Upper bound of the per-process `pg` pool. Keep small on Neon (the pooler multiplexes).
    DATABASE_POOL_MAX: intSetting(10, 1, 100),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6379'),

    NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
    CORS_ORIGINS: csv.optional(),

    // --- Authentication (PHASE 03, docs/AUTHENTICATION.md) -------------------------------
    // HS256 signing key for access tokens. Required in every environment.
    JWT_SECRET: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'JWT_SECRET is required (see .env.example for how to generate one)' })
        .min(32, 'JWT_SECRET must be at least 32 characters'),
    ),
    JWT_ISSUER: z.preprocess(emptyToUndefined, z.string().min(1).default('asra-academy-api')),
    JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).default('asra-academy-web')),
    JWT_ACCESS_TTL_MINUTES: intSetting(15, 1, 60),
    REFRESH_SESSION_TTL_DAYS: intSetting(30, 1, 90),
    PASSWORD_RESET_TTL_MINUTES: intSetting(30, 5, 24 * 60),
    EMAIL_VERIFICATION_TTL_HOURS: intSetting(24, 1, 7 * 24),

    // Refresh-token cookie. Secure defaults to true outside development/test.
    AUTH_COOKIE_SECURE: boolSetting,
    AUTH_COOKIE_SAME_SITE: z.preprocess(
      emptyToUndefined,
      z.enum(['strict', 'lax', 'none']).default('strict'),
    ),
    AUTH_COOKIE_DOMAIN: optionalString,

    // --- Email (provider pending — CLIENT-CLARIFICATIONS Q-01) ---------------------------
    // console: development only — prints messages (including links) to the API log.
    // memory:  automated tests only — keeps messages in process memory.
    EMAIL_TRANSPORT: z.preprocess(emptyToUndefined, z.enum(['console', 'memory']).optional()),
    EMAIL_FROM: z.preprocess(
      emptyToUndefined,
      z.string().min(3).default('ASRA Academy <no-reply@localhost>'),
    ),

    // --- Rate limiting --------------------------------------------------------------------
    // redis: shared across API instances (falls back to per-process memory if Redis is down).
    // memory: per-process only; default for tests.
    RATE_LIMIT_STORE: z.preprocess(emptyToUndefined, z.enum(['redis', 'memory']).optional()),
  })
  .transform((env) => ({
    ...env,
    AUTH_COOKIE_SECURE: env.AUTH_COOKIE_SECURE ?? !['development', 'test'].includes(env.NODE_ENV),
    EMAIL_TRANSPORT: env.EMAIL_TRANSPORT ?? (env.NODE_ENV === 'test' ? 'memory' : 'console'),
    RATE_LIMIT_STORE: env.RATE_LIMIT_STORE ?? (env.NODE_ENV === 'test' ? 'memory' : 'redis'),
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'Must be true in production (refresh cookie requires HTTPS)',
      });
    }
    // No production email provider exists yet (CLIENT-CLARIFICATIONS Q-01). Refusing to start
    // is safer than silently pretending verification/reset emails were delivered.
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_TRANSPORT'],
      message: `"${env.EMAIL_TRANSPORT}" is a development/test transport. Configure a production email provider (pending CLIENT-CLARIFICATIONS Q-01).`,
    });
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_COOKIE_SAME_SITE === 'none' && !env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SAME_SITE'],
        message: 'SameSite=None requires AUTH_COOKIE_SECURE=true',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  // Normalised to bare origins (scheme://host[:port]) so they compare equal to `Origin` headers.
  corsOrigins: (raw.CORS_ORIGINS?.length ? raw.CORS_ORIGINS : [raw.NEXT_PUBLIC_APP_URL]).map(
    (origin) => new URL(origin).origin,
  ),
} as const;

export type Env = typeof env;
