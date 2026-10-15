import { z } from 'zod';
import {
  booleanQuerySchema,
  optionalSlugInputSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchQuerySchema,
} from './common.js';

/**
 * Academic structure (PHASE 06): academic levels, classes, streams and subjects, plus course
 * categories. Shared by the admin API (`/api/v1/admin/*`) and the admin forms.
 *
 * Create schemas carry defaults; update schemas are built from the same fields WITHOUT defaults,
 * because Zod applies defaults inside `.partial()` and a PATCH must never reset omitted fields.
 * All objects are `.strict()`: unknown keys (ids, timestamps, counts…) are rejected, which
 * prevents mass assignment.
 */

export const catalogueNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');

const sortOrderSchema = z.number().int().min(0).max(10_000);

const levelFields = {
  name: catalogueNameSchema,
  slug: optionalSlugInputSchema,
  description: optionalTextSchema(2000),
  /** Curriculum/board label, e.g. "CBSE" (A-03 pending). */
  board: optionalTextSchema(50),
  sortOrder: sortOrderSchema,
  isActive: z.boolean(),
};

export const academicLevelCreateSchema = z
  .object({
    ...levelFields,
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export const academicLevelUpdateSchema = z.object(levelFields).partial().strict();

const classFields = {
  academicLevelId: z.uuid('Choose an academic level'),
  name: catalogueNameSchema,
  slug: optionalSlugInputSchema,
  /** Numeric grade for filtering (e.g. 10); optional and not unique (A-03). */
  gradeNumber: z.number().int().min(1).max(20).nullable().optional(),
  sortOrder: sortOrderSchema,
  isActive: z.boolean(),
};

export const classCreateSchema = z
  .object({
    ...classFields,
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export const classUpdateSchema = z.object(classFields).partial().strict();

const streamFields = {
  academicLevelId: z.uuid('Choose an academic level'),
  name: catalogueNameSchema,
  slug: optionalSlugInputSchema,
  description: optionalTextSchema(2000),
  sortOrder: sortOrderSchema,
  isActive: z.boolean(),
};

export const streamCreateSchema = z
  .object({
    ...streamFields,
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export const streamUpdateSchema = z.object(streamFields).partial().strict();

const subjectFields = {
  name: catalogueNameSchema,
  slug: optionalSlugInputSchema,
  /** Optional board subject code, e.g. CBSE "041". Stored upper-case. */
  code: z
    .string()
    .trim()
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Za-z0-9-]*$/, 'Use letters, digits and hyphens')
    .nullable()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : value === '' ? null : value)),
  description: optionalTextSchema(2000),
  isActive: z.boolean(),
};

export const subjectCreateSchema = z
  .object({ ...subjectFields, isActive: z.boolean().default(true) })
  .strict();
export const subjectUpdateSchema = z.object(subjectFields).partial().strict();

const categoryFields = {
  name: catalogueNameSchema,
  slug: optionalSlugInputSchema,
  description: optionalTextSchema(2000),
  sortOrder: sortOrderSchema,
  isActive: z.boolean(),
};

export const courseCategoryCreateSchema = z
  .object({
    ...categoryFields,
    sortOrder: sortOrderSchema.default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export const courseCategoryUpdateSchema = z.object(categoryFields).partial().strict();

/** `GET /admin/{academic-levels,classes,streams,subjects,course-categories}` */
export const catalogueListQuerySchema = paginationQuerySchema
  .extend({
    q: searchQuerySchema,
    isActive: booleanQuerySchema,
    /** Classes and streams only. */
    academicLevelId: z.uuid().optional(),
  })
  .strict();

export type AcademicLevelCreateInput = z.infer<typeof academicLevelCreateSchema>;
export type AcademicLevelUpdateInput = z.infer<typeof academicLevelUpdateSchema>;
export type ClassCreateInput = z.infer<typeof classCreateSchema>;
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;
export type StreamCreateInput = z.infer<typeof streamCreateSchema>;
export type StreamUpdateInput = z.infer<typeof streamUpdateSchema>;
export type SubjectCreateInput = z.infer<typeof subjectCreateSchema>;
export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>;
export type CourseCategoryCreateInput = z.infer<typeof courseCategoryCreateSchema>;
export type CourseCategoryUpdateInput = z.infer<typeof courseCategoryUpdateSchema>;
export type CatalogueListQuery = z.infer<typeof catalogueListQuerySchema>;
