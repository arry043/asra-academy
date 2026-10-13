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
    DATABASE_POOL_MAX: z.preprocess(
      (value) => emptyToUndefined(value) ?? '10',
      z.coerce.number().int().min(1).max(100),
    ),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6379'),

    NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
    CORS_ORIGINS: csv.optional(),

    // Used from PHASE 03 (authentication). Validated now so misconfiguration surfaces early.
    JWT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Required in production' });
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
  corsOrigins: raw.CORS_ORIGINS?.length ? raw.CORS_ORIGINS : [raw.NEXT_PUBLIC_APP_URL],
} as const;

export type Env = typeof env;
