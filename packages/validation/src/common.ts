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

/**
 * Derives a URL slug from free text ("Class 10 — Mathematics!" → "class-10-mathematics").
 * Accents are folded to ASCII; characters outside a–z/0–9 (including non-Latin scripts such as
 * Arabic or Urdu) are dropped, so the result may be empty — callers must handle that.
 */
export function slugify(text: string, maxLength = 200): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Optional slug input: omitted or "" means "generate it from the name/title". */
export const optionalSlugInputSchema = z
  .union([z.literal(''), slugSchema])
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Optional free text. Trimmed; an empty string becomes `null` so a form can clear the field.
 * `undefined` (key omitted) stays `undefined`, meaning "leave unchanged" on PATCH.
 */
export function optionalTextSchema(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));
}

/** Optional UUID reference; `null` (or "") clears the relation, omitted leaves it unchanged. */
export const optionalUuidSchema = z
  .union([z.literal(''), z.uuid()])
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

/** Free-text search query for list endpoints. Empty means "no search". */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => (value ? value : undefined));

/** `true`/`false` from a query string; anything else is rejected, omission means "any". */
export const booleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/**
 * A link to a third-party page or file that users' browsers will open. HTTPS only (no
 * `javascript:`, `data:`, `http:` …), a public domain name (no `localhost`/IP literals) and no
 * embedded credentials. The API stores these URLs but never fetches them (no SSRF surface).
 */
export const safeExternalUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL must be at most 2048 characters')
  .pipe(
    z.url({
      protocol: /^https$/,
      hostname: z.regexes.domain,
      message: 'Enter a full https:// address on a public domain',
    }),
  )
  // Zod still runs this refinement when the URL check above has failed, so it must not throw
  // (`new URL` is used over `URL.parse` because the schema also runs in older browsers).
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.username === '' && url.password === '';
    } catch {
      return true; // already reported as an invalid URL
    }
  }, 'URLs must not contain a username or password');
