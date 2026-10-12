import { z } from 'zod';

/**
 * Public (browser-exposed) configuration. Only `NEXT_PUBLIC_*` variables belong here;
 * they are inlined at build time, so each must be referenced explicitly.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api/v1'),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
});
