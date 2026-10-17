import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import {
  optionalTextSchema,
  paginationQuerySchema,
  safeExternalUrlSchema,
  searchQuerySchema,
} from './common.js';
import { curriculumTitleSchema, LESSON_CONTENT_TYPES, LESSON_STATUSES } from './curriculum.js';
import { phoneSchema } from './student.js';

/**
 * Faculty portal (PHASE 08) request schemas, shared by the API and the faculty/student portals.
 * Every body schema is `.strict()`, so ids, statuses, reviewers, timestamps or scores computed by
 * the server can never be over-posted. Rules: docs/FACULTY-PORTAL.md.
 */

/** ISO-8601 instant WITH an offset, e.g. "2026-11-02T10:30:00+05:30" (V-09: IST in the UI). */
export const isoInstantSchema = z.iso.datetime({
  offset: true,
  message: 'Enter a valid date and time',
});

const optionalInstantSchema = z
  .union([z.literal(''), isoInstantSchema])
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

const optionalLinkSchema = z
  .union([z.literal(''), safeExternalUrlSchema])
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

// --- Lists ----------------------------------------------------------------------------------

export const facultyCourseListQuerySchema = paginationQuerySchema.extend({ q: searchQuerySchema });
export type FacultyCourseListQuery = z.infer<typeof facultyCourseListQuerySchema>;

export const facultyStudentListQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  courseId: z.uuid().optional(),
});
export type FacultyStudentListQuery = z.infer<typeof facultyStudentListQuerySchema>;

export const facultyLessonListQuerySchema = paginationQuerySchema.extend({
  contentType: z.enum(LESSON_CONTENT_TYPES),
  courseId: z.uuid().optional(),
});
export type FacultyLessonListQuery = z.infer<typeof facultyLessonListQuerySchema>;

export const facultyAssignmentListQuerySchema = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
});
export type FacultyAssignmentListQuery = z.infer<typeof facultyAssignmentListQuerySchema>;

/** Review queue filter: `RELEASED` is a GRADED submission whose result students can see. */
export const SUBMISSION_FILTERS = ['SUBMITTED', 'GRADED', 'RELEASED'] as const;
export type SubmissionFilter = (typeof SUBMISSION_FILTERS)[number];

export const submissionListQuerySchema = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
  /** The assignment's LESSON id (assignments are addressed by their lesson). */
  lessonId: z.uuid().optional(),
  status: z.enum(SUBMISSION_FILTERS).optional(),
  /** Oldest first by default: the review queue is worked through in submission order. */
  sort: z.enum(['oldest', 'newest']).default('oldest'),
});
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>;

export const LIVE_CLASS_WINDOWS = ['upcoming', 'past'] as const;

export const liveClassListQuerySchema = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
  when: z.enum(LIVE_CLASS_WINDOWS).default('upcoming'),
});
export type LiveClassListQuery = z.infer<typeof liveClassListQuerySchema>;

// --- Assignments ----------------------------------------------------------------------------

/** Numeric marks (I-03 assumption). Mirrors CHECK `assignments_max_marks_range`. */
export const MAX_ASSIGNMENT_MARKS = 1000;

const maxMarksSchema = z
  .number({ message: 'Enter the maximum marks' })
  .int('Use whole marks')
  .min(1, 'At least 1 mark')
  .max(MAX_ASSIGNMENT_MARKS, `At most ${MAX_ASSIGNMENT_MARKS} marks`);

/**
 * Late/resubmission policy (PHASE 09, I-02 pending). Omitted = keep the current value (or the
 * PHASE 08 defaults for new settings: late work accepted and flagged, no resubmission).
 */
const submissionPolicyFields = {
  allowLateSubmissions: z.boolean().optional(),
  allowResubmission: z.boolean().optional(),
};

/** Submission settings of an existing ASSIGNMENT lesson (create or update). */
export const assignmentSettingsSchema = z
  .object({ maxMarks: maxMarksSchema, dueAt: optionalInstantSchema, ...submissionPolicyFields })
  .strict();
export type AssignmentSettingsInput = z.infer<typeof assignmentSettingsSchema>;

/** Creates an ASSIGNMENT lesson and its submission settings in one step. */
export const assignmentCreateSchema = z
  .object({
    title: curriculumTitleSchema,
    description: optionalTextSchema(5000),
    instructions: z
      .string()
      .trim()
      .min(1, 'Write the instructions students should follow')
      .max(50_000, 'Must be at most 50000 characters'),
    status: z.enum(LESSON_STATUSES).default('DRAFT'),
    maxMarks: maxMarksSchema,
    dueAt: optionalInstantSchema,
    ...submissionPolicyFields,
  })
  .strict();
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;

/** Marks + feedback. The server checks `marksAwarded` against the assignment's maximum. */
export const gradeSubmissionSchema = z
  .object({
    marksAwarded: z
      .number({ message: 'Enter the marks' })
      .int('Use whole marks')
      .min(0, 'Marks cannot be negative')
      .max(MAX_ASSIGNMENT_MARKS, `At most ${MAX_ASSIGNMENT_MARKS} marks`),
    feedback: optionalTextSchema(5000),
    /** Private to faculty — never shown to the student. */
    facultyNote: optionalTextSchema(5000),
    /** The submission's `updatedAt` when the reviewer opened it; a mismatch → 409. */
    expectedUpdatedAt: isoInstantSchema.optional(),
  })
  .strict();
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

/** A student's answer: text plus an optional https:// link (no file storage yet, R-01). */
export const STUDENT_SUBMISSION_MAX_LENGTH = 20_000;

export const studentSubmissionSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Write your answer before submitting')
      .max(
        STUDENT_SUBMISSION_MAX_LENGTH,
        `Must be at most ${STUDENT_SUBMISSION_MAX_LENGTH} characters`,
      ),
    attachmentUrl: optionalLinkSchema,
  })
  .strict();
export type StudentSubmissionInput = z.infer<typeof studentSubmissionSchema>;

// --- Live classes ---------------------------------------------------------------------------

/** Mirrors CHECK `live_class_sessions_duration_range`. */
export const LIVE_CLASS_MIN_MINUTES = 15;
export const LIVE_CLASS_MAX_MINUTES = 480;

const liveClassFields = {
  title: curriculumTitleSchema,
  description: optionalTextSchema(5000),
  startsAt: isoInstantSchema,
  durationMinutes: z
    .number({ message: 'Enter the duration in minutes' })
    .int('Use whole minutes')
    .min(LIVE_CLASS_MIN_MINUTES, `At least ${LIVE_CLASS_MIN_MINUTES} minutes`)
    .max(LIVE_CLASS_MAX_MINUTES, `At most ${LIVE_CLASS_MAX_MINUTES} minutes`),
  /** A meeting link created by the faculty member in their own tool (no provider API, F-01). */
  joinUrl: optionalLinkSchema,
};

export const liveClassCreateSchema = z.object(liveClassFields).strict();
export type LiveClassCreateInput = z.infer<typeof liveClassCreateSchema>;

export const liveClassUpdateSchema = z
  .object(liveClassFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type LiveClassUpdateInput = z.infer<typeof liveClassUpdateSchema>;

// --- Profile --------------------------------------------------------------------------------

/**
 * The ONLY profile fields faculty may change themselves. Employee code, designation and public
 * visibility are administrative (C-02, Z-05); course/subject allocation is never self-service.
 */
export const facultyProfileUpdateSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneSchema,
    bio: optionalTextSchema(5000),
    qualifications: optionalTextSchema(500),
    specialization: optionalTextSchema(255),
    experienceYears: z.number().int('Use whole years').min(0).max(70).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type FacultyProfileUpdateInput = z.infer<typeof facultyProfileUpdateSchema>;

// --- Student lists --------------------------------------------------------------------------

export const studentLiveClassQuerySchema = paginationQuerySchema.extend({
  when: z.enum(LIVE_CLASS_WINDOWS).default('upcoming'),
});
export type StudentLiveClassQuery = z.infer<typeof studentLiveClassQuerySchema>;
