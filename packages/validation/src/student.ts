import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import {
  booleanQuerySchema,
  emailSchema,
  paginationQuerySchema,
  searchQuerySchema,
} from './common.js';
import { LESSON_CONTENT_TYPES } from './curriculum.js';

/**
 * Student LMS (PHASE 07) request schemas, shared by the API and the student portal.
 * Every body schema is `.strict()`: unknown keys (e.g. `role`, `status`, `email`) are rejected,
 * so a profile or progress request can never over-post privileged fields.
 */

/**
 * Optional contact number as stored in `users.phone` (VARCHAR 20). Digits with an optional
 * leading "+", spaces, hyphens and brackets; 7–15 digits. Whether phone is required/unique is
 * pending (CLIENT-CLARIFICATIONS D-01/D-02). "" or null clears it.
 */
export const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number must be at most 20 characters')
  .refine(
    (value) => value === '' || /^\+?[0-9][0-9 ()-]*$/.test(value),
    'Use digits, spaces, hyphens or brackets, with an optional leading +',
  )
  .refine((value) => {
    if (value === '') return true;
    const digits = value.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'Enter a phone number with 7 to 15 digits')
  .nullable()
  .transform((value) => (value === '' ? null : value));

/** The ONLY profile fields a student may change themselves. Email changes need re-verification. */
export const studentProfileUpdateSchema = z
  .object({ fullName: fullNameSchema, phone: phoneSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');

export type StudentProfileUpdateInput = z.infer<typeof studentProfileUpdateSchema>;

/**
 * Video heartbeat. The client reports where the playhead is and how many seconds it played since
 * its previous heartbeat; the server bounds the credit by wall-clock time and never accepts a
 * percentage or a "completed" flag (docs/STUDENT-LMS.md §5).
 */
export const VIDEO_HEARTBEAT_MAX_SECONDS = 120;

export const videoProgressSchema = z
  .object({
    positionSeconds: z.number().min(0).max(86_400).transform(Math.floor),
    playedSeconds: z.number().min(0).max(VIDEO_HEARTBEAT_MAX_SECONDS).transform(Math.floor),
  })
  .strict();

export type VideoProgressInput = z.infer<typeof videoProgressSchema>;

/** `/student/enrollments` — the student's own enrolment records. */
export const studentEnrollmentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
  /** `true` = only courses whose every eligible lesson was completed at some point. */
  completed: booleanQuerySchema,
});

export type StudentEnrollmentListQuery = z.infer<typeof studentEnrollmentListQuerySchema>;

/** `/student/catalog` — published courses the student can see, with their access state. */
export const studentCatalogQuerySchema = paginationQuerySchema.extend({ q: searchQuerySchema });

export type StudentCatalogQuery = z.infer<typeof studentCatalogQuerySchema>;

/** `/student/lessons?contentType=QUIZ` — lessons of one kind across the student's courses. */
export const studentLessonListQuerySchema = paginationQuerySchema.extend({
  contentType: z.enum(LESSON_CONTENT_TYPES),
  courseId: z.uuid().optional(),
});

export type StudentLessonListQuery = z.infer<typeof studentLessonListQuerySchema>;

// --- Administration -------------------------------------------------------------------------

/** Manual enrolment by an administrator: the student is identified by their account email. */
export const adminEnrollmentCreateSchema = z.object({ email: emailSchema }).strict();

export type AdminEnrollmentCreateInput = z.infer<typeof adminEnrollmentCreateSchema>;

export const adminEnrollmentListQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
});

export type AdminEnrollmentListQuery = z.infer<typeof adminEnrollmentListQuerySchema>;
