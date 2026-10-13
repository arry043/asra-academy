import { z } from 'zod';

/** Shared primitives reused by API request validators and web forms. */

export const uuidSchema = z.uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const appEnvironmentSchema = z.enum(['development', 'test', 'production']);

/**
 * Email normalised the same way the database requires (CHECK `users_email_normalized`):
 * trimmed and lower-cased before validation.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(320, 'Email must be at most 320 characters'));

/** URL slug: lower-case words separated by single hyphens (matches the `*_slug_format` CHECKs). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, digits and single hyphens');

/** 0-based ordering index within a parent (modules, chapters, lessons, resources). */
export const positionSchema = z.number().int().min(0);
