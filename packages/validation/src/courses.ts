import { z } from 'zod';
import {
  optionalSlugInputSchema,
  optionalTextSchema,
  optionalUuidSchema,
  paginationQuerySchema,
  safeExternalUrlSchema,
  searchQuerySchema,
  slugSchema,
} from './common.js';

/**
 * Courses (PHASE 06) — shared by the admin API and the admin course form.
 * Rules are documented in docs/COURSE-MANAGEMENT.md; the database mirrors the numeric ones as
 * CHECK constraints (migration 20261015071102_phase06_course_management).
 */

export const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const COURSE_VISIBILITIES = ['PUBLIC', 'UNLISTED', 'PRIVATE'] as const;
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;

/**
 * Currencies an administrator may choose. INR only is the documented assumption
 * (CLIENT-CLARIFICATIONS M-03, pending); add codes here once confirmed.
 */
export const SUPPORTED_CURRENCIES = ['INR'] as const;

/** Upper bound for a price in minor units (₹10,00,000.00) — guards against typos. */
export const MAX_PRICE_MINOR = 100_000_000;

/**
 * Slugs used by the static special-course programme pages at `/courses/<slug>`
 * (apps/web/src/content/programmes.ts). A course with one of these slugs would be shadowed by the
 * programme page, so they are reserved. The web test suite asserts the two lists stay in sync.
 */
export const RESERVED_COURSE_SLUGS = [
  'english',
  'entrepreneurship',
  'quranic-studies',
  'arabic',
  'urdu',
] as const;

export function isReservedCourseSlug(slug: string): boolean {
  return (RESERVED_COURSE_SLUGS as readonly string[]).includes(slug);
}

export const courseTitleSchema = z
  .string()
  .trim()
  .min(3, 'Title must be at least 3 characters')
  .max(200, 'Title must be at most 200 characters');

const courseSlugInputSchema = optionalSlugInputSchema.refine(
  (value) => value === undefined || !isReservedCourseSlug(value),
  'This address is used by a programme page. Choose a different slug.',
);

/** Fields shared by create and update; no defaults here (see academics.ts for why). */
const courseFields = {
  title: courseTitleSchema,
  slug: courseSlugInputSchema,
  summary: optionalTextSchema(500),
  description: optionalTextSchema(20_000),
  visibility: z.enum(COURSE_VISIBILITIES),
  categoryId: optionalUuidSchema,
  classId: optionalUuidSchema,
  streamId: optionalUuidSchema,
  subjectId: optionalUuidSchema,
  thumbnailUrl: z
    .union([z.literal(''), safeExternalUrlSchema])
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value)),
  /** Estimated total learning time in minutes (1 minute – 10,000 hours). */
  durationMinutes: z
    .number()
    .int('Duration must be a whole number of minutes')
    .min(1, 'Duration must be at least 1 minute')
    .max(600_000)
    .nullable()
    .optional(),
  /** Minor units (paise). 0 = free; null = no price set yet (B-04 pending). */
  priceMinor: z
    .number()
    .int('Price must be in whole minor units (e.g. paise)')
    .min(0, 'Price cannot be negative')
    .max(MAX_PRICE_MINOR, 'Price is too large')
    .nullable()
    .optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES).nullable().optional(),
  discountValue: z
    .number()
    .int('Discount must be a whole number')
    .min(1, 'Discount must be at least 1')
    .nullable()
    .optional(),
};

export interface CoursePricing {
  priceMinor: number | null;
  currency: string | null;
  discountType: (typeof DISCOUNT_TYPES)[number] | null;
  discountValue: number | null;
}

export interface FieldIssue {
  path: string[];
  message: string;
}

/**
 * Cross-field pricing rules, applied to the FINAL state of a course (the API merges a PATCH with
 * the stored row before calling this). Mirrors the `courses_*` CHECK constraints. No final or
 * checkout price is derived here — that belongs to PHASE 10.
 */
export function validateCoursePricing(pricing: CoursePricing): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { priceMinor, currency, discountType, discountValue } = pricing;

  if (priceMinor !== null && currency === null) {
    issues.push({ path: ['currency'], message: 'Choose a currency for the price' });
  }
  if (priceMinor === null && currency !== null) {
    issues.push({ path: ['priceMinor'], message: 'Enter a price or clear the currency' });
  }
  if ((discountType === null) !== (discountValue === null)) {
    issues.push({
      path: [discountType === null ? 'discountType' : 'discountValue'],
      message: 'Discount type and value must be set together',
    });
  }
  if (discountType !== null && discountValue !== null) {
    if (priceMinor === null || priceMinor === 0) {
      issues.push({ path: ['discountType'], message: 'A discount needs a paid price' });
    } else if (discountType === 'PERCENTAGE' && (discountValue < 1 || discountValue > 100)) {
      issues.push({ path: ['discountValue'], message: 'Percentage must be between 1 and 100' });
    } else if (discountType === 'FIXED_AMOUNT' && discountValue > priceMinor) {
      issues.push({ path: ['discountValue'], message: 'Discount cannot exceed the price' });
    }
  }
  return issues;
}

/**
 * Applies the pricing rules when all four values are provided (always true for create, whose
 * defaults are `null`). A partial PATCH is checked by the API against the merged final state.
 */
function refinePricing(value: Partial<CoursePricing>, context: z.RefinementCtx): void {
  const keys = ['priceMinor', 'currency', 'discountType', 'discountValue'] as const;
  if (!keys.every((key) => value[key] !== undefined)) return;
  for (const issue of validateCoursePricing({
    priceMinor: value.priceMinor ?? null,
    currency: value.currency ?? null,
    discountType: value.discountType ?? null,
    discountValue: value.discountValue ?? null,
  })) {
    context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
}

export const courseCreateSchema = z
  .object({
    ...courseFields,
    visibility: z.enum(COURSE_VISIBILITIES).default('PUBLIC'),
    priceMinor: courseFields.priceMinor.default(null),
    currency: courseFields.currency.default(null),
    discountType: courseFields.discountType.default(null),
    discountValue: courseFields.discountValue.default(null),
  })
  .strict()
  .superRefine(refinePricing);

/**
 * PATCH body. `expectedUpdatedAt` (the `updatedAt` the editor loaded) enables optimistic
 * concurrency: if the course changed since, the API answers 409 instead of overwriting.
 */
export const courseUpdateSchema = z
  .object({ ...courseFields, expectedUpdatedAt: z.iso.datetime().optional() })
  .partial()
  .strict()
  .superRefine(refinePricing);

/** Body of publish / unpublish / archive / restore. The body itself is optional. */
export const courseTransitionSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime().optional() })
  .strict()
  .optional()
  .transform((value) => value ?? {});

/**
 * Replaces a course's instructor list. Exactly one primary instructor when the list is not empty
 * (CourseInstructor.isPrimary — "at most one" is enforced here and in the service).
 */
export const courseInstructorsSchema = z
  .object({
    instructors: z
      .array(z.object({ facultyProfileId: z.uuid(), isPrimary: z.boolean() }).strict())
      .max(20, 'At most 20 instructors per course'),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.instructors.map((item) => item.facultyProfileId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['instructors'],
        message: 'Each faculty member can be assigned only once',
      });
    }
    const primaries = value.instructors.filter((item) => item.isPrimary).length;
    if (value.instructors.length > 0 && primaries !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['instructors'],
        message: 'Choose exactly one primary instructor',
      });
    }
  });

/** `GET /admin/courses` */
export const adminCourseListQuerySchema = paginationQuerySchema
  .extend({
    q: searchQuerySchema,
    status: z.enum(PUBLICATION_STATUSES).optional(),
    visibility: z.enum(COURSE_VISIBILITIES).optional(),
    categoryId: z.uuid().optional(),
    classId: z.uuid().optional(),
    subjectId: z.uuid().optional(),
  })
  .strict();

/** `GET /admin/faculty` — faculty options for instructor assignment. */
export const facultyOptionsQuerySchema = z
  .object({ q: searchQuerySchema, limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

/** `GET /courses` (public). Filters are slugs so URLs stay readable. */
export const publicCourseListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
    q: searchQuerySchema,
    category: slugSchema.optional(),
    class: slugSchema.optional(),
    subject: slugSchema.optional(),
  })
  .strict();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
export type CourseTransitionInput = z.infer<typeof courseTransitionSchema>;
export type CourseInstructorsInput = z.infer<typeof courseInstructorsSchema>;
export type AdminCourseListQuery = z.infer<typeof adminCourseListQuerySchema>;
export type FacultyOptionsQuery = z.infer<typeof facultyOptionsQuerySchema>;
export type PublicCourseListQuery = z.infer<typeof publicCourseListQuerySchema>;
