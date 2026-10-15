import { randomBytes } from 'node:crypto';
import { slugify } from '@asra/validation';
import { fieldError } from './app-error.js';

interface ResolveSlugOptions {
  /** Slug supplied by the administrator, already validated by `slugSchema`. */
  requested: string | undefined;
  /** Text to derive a slug from when none is supplied (name or title). */
  source: string;
  /** Base used when `source` has no Latin letters or digits (e.g. an Urdu-only title). */
  fallback: string;
  /** Column length (`VarChar(n)`). */
  maxLength: number;
  /** Whether another row already uses the slug. */
  isTaken: (slug: string) => Promise<boolean>;
}

const MAX_SUFFIX_ATTEMPTS = 50;

/**
 * Picks the slug to store, predictably:
 *   - A requested slug is used as-is, or rejected with 409 `slug` if another row has it
 *     (never silently changed — the administrator chose that URL).
 *   - Otherwise the slug is derived from `source`; on collision `-2`, `-3`, … is appended.
 * The unique index still guards against a concurrent insert (→ 409 via the error handler).
 */
export async function resolveUniqueSlug(options: ResolveSlugOptions): Promise<string> {
  if (options.requested) {
    if (await options.isTaken(options.requested)) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    return options.requested;
  }

  // Leave room for a "-NN" suffix within the column length.
  const base = slugify(options.source, options.maxLength - 4) || options.fallback;
  if (!(await options.isTaken(base))) return base;
  for (let suffix = 2; suffix <= MAX_SUFFIX_ATTEMPTS; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await options.isTaken(candidate))) return candidate;
  }
  return `${base.slice(0, options.maxLength - 9)}-${randomBytes(4).toString('hex')}`;
}
