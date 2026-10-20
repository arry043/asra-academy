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

export const LIVE_CLASS_STATUSES = ['SCHEDULED', 'CANCELLED', 'COMPLETED'] as const;

/** Administrators see every course's classes (`live_classes.manage`, PHASE 11). */
export const adminLiveClassListQuerySchema = liveClassListQuerySchema.extend({
  status: z.enum(LIVE_CLASS_STATUSES).optional(),
});
export type AdminLiveClassListQuery = z.infer<typeof adminLiveClassListQuerySchema>;

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

/**
 * Zones a class can be scheduled in. The academy schedules in IST (V-09); instants are always
 * stored in UTC and the zone is kept with the class so every screen and email shows the same time.
 */
export const LIVE_CLASS_TIME_ZONES = ['Asia/Kolkata'] as const;
export const DEFAULT_LIVE_CLASS_TIME_ZONE = LIVE_CLASS_TIME_ZONES[0];

/**
 * How a new class gets its meeting link (docs/LIVE-CLASSES.md §3):
 *   - `manual`: staff paste a link created in their own tool (or leave it empty for now);
 *   - `google_meet`: the server creates a Google Meet space (requires server configuration).
 */
export const LIVE_CLASS_MEETING_OPTIONS = ['manual', 'google_meet'] as const;
export type LiveClassMeetingOption = (typeof LIVE_CLASS_MEETING_OPTIONS)[number];

const liveClassFields = {
  title: curriculumTitleSchema,
  description: optionalTextSchema(5000),
  startsAt: isoInstantSchema,
  durationMinutes: z
    .number({ message: 'Enter the duration in minutes' })
    .int('Use whole minutes')
    .min(LIVE_CLASS_MIN_MINUTES, `At least ${LIVE_CLASS_MIN_MINUTES} minutes`)
    .max(LIVE_CLASS_MAX_MINUTES, `At most ${LIVE_CLASS_MAX_MINUTES} minutes`),
  timeZone: z.enum(LIVE_CLASS_TIME_ZONES, { message: 'Choose a supported time zone' }).optional(),
  /** A meeting link created by staff in their own tool (`provider = 'manual'`). */
  joinUrl: optionalLinkSchema,
};

const meetingField = {
  meeting: z
    .enum(LIVE_CLASS_MEETING_OPTIONS, { message: 'Choose how to add the meeting' })
    .optional(),
};

/** A pasted link and an automatic Google Meet link are mutually exclusive. */
function noLinkWithGoogleMeet(value: {
  meeting?: LiveClassMeetingOption;
  joinUrl?: string | null;
}) {
  return !(value.meeting === 'google_meet' && value.joinUrl);
}
const linkConflict = {
  message: 'Leave the link empty when Google Meet creates it',
  path: ['joinUrl'],
};

export const liveClassCreateSchema = z
  .object({ ...liveClassFields, ...meetingField })
  .strict()
  .refine(noLinkWithGoogleMeet, linkConflict);
export type LiveClassCreateInput = z.infer<typeof liveClassCreateSchema>;

/** Editing never creates a provider meeting; use `POST …/live-classes/:id/meeting` for that. */
export const liveClassUpdateSchema = z
  .object(liveClassFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type LiveClassUpdateInput = z.infer<typeof liveClassUpdateSchema>;

/** Admin scheduling: course and host faculty are chosen explicitly (PHASE 11). */
export const adminLiveClassCreateSchema = z
  .object({
    ...liveClassFields,
    ...meetingField,
    courseId: z.uuid({ message: 'Choose a course' }),
    hostFacultyProfileId: z.uuid({ message: 'Choose the faculty member who hosts the class' }),
  })
  .strict()
  .refine(noLinkWithGoogleMeet, linkConflict);
export type AdminLiveClassCreateInput = z.infer<typeof adminLiveClassCreateSchema>;

export const adminLiveClassUpdateSchema = z
  .object({
    ...liveClassFields,
    hostFacultyProfileId: z.uuid({ message: 'Choose the faculty member who hosts the class' }),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type AdminLiveClassUpdateInput = z.infer<typeof adminLiveClassUpdateSchema>;

// --- Recordings (manual YouTube links, F-04) -------------------------------------------------

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/**
 * The 11-character video id of a YouTube watch/live/embed/youtu.be link, or null. Playlists,
 * channels, shorts and look-alike domains are refused.
 */
export function youtubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null | undefined = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch' && second === undefined) id = url.searchParams.get('v');
    else if ((first === 'live' || first === 'embed') && second) id = second;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * A YouTube recording link, normalised to `https://www.youtube.com/watch?v=<id>` (tracking and
 * timestamp parameters are dropped). Unlisted is NOT private: the LMS only decides who is SHOWN
 * the link (docs/LIVE-CLASSES.md §6).
 */
export const youtubeRecordingUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL must be at most 2048 characters')
  .transform((value, ctx) => {
    const id = youtubeVideoId(value);
    if (!id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a YouTube video link, e.g. https://www.youtube.com/watch?v=…',
      });
      return z.NEVER;
    }
    return `https://www.youtube.com/watch?v=${id}`;
  });

/** `null` (or "") removes the recording link. */
export const liveClassRecordingSchema = z
  .object({
    recordingUrl: z
      .union([z.literal(''), youtubeRecordingUrlSchema])
      .nullable()
      .transform((value) => (value === '' ? null : value)),
  })
  .strict();
export type LiveClassRecordingInput = z.infer<typeof liveClassRecordingSchema>;

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
  /** Limit to one enrolled course (course pages). */
  courseId: z.uuid().optional(),
});
export type StudentLiveClassQuery = z.infer<typeof studentLiveClassQuerySchema>;
