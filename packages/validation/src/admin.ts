import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema } from './common.js';
import { PAYMENT_MODES } from './payments.js';

/**
 * Query and body schemas of the PHASE 12 administration endpoints (docs/ADMIN-DASHBOARD.md).
 * The API re-validates every request with these; the web app uses them for its filters.
 */

/** Longest analytics window (inclusive days). Wider requests are refused, not truncated. */
export const ANALYTICS_MAX_RANGE_DAYS = 731;
/** Daily buckets are limited to one year so a chart never has more than 366 points. */
export const ANALYTICS_MAX_DAILY_DAYS = 366;
export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` that is a real calendar day (2026-02-30 is refused). */
export const calendarDaySchema = z
  .string()
  .regex(DAY, 'Use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Invalid date');

/** Whole days from `from` to `to`, inclusive. */
export function inclusiveDays(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

const rangeFields = {
  /** First day (inclusive) in the analytics time zone. Default: 29 days before `to`. */
  from: calendarDaySchema.optional(),
  /** Last day (inclusive). Default: today in the analytics time zone. */
  to: calendarDaySchema.optional(),
  /** Default: day ≤ 62 days, week ≤ 366 days, otherwise month. */
  granularity: z.enum(ANALYTICS_GRANULARITIES).optional(),
};

function checkRange(
  value: { from?: string; to?: string; granularity?: string },
  ctx: z.RefinementCtx,
): void {
  if (!value.from || !value.to) return;
  const days = inclusiveDays(value.from, value.to);
  if (days < 1) {
    ctx.addIssue({ code: 'custom', path: ['from'], message: '"From" must not be after "to"' });
  } else if (days > ANALYTICS_MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['from'],
      message: `Choose a range of at most ${ANALYTICS_MAX_RANGE_DAYS} days`,
    });
  } else if (value.granularity === 'day' && days > ANALYTICS_MAX_DAILY_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['granularity'],
      message: `Daily grouping is available for up to ${ANALYTICS_MAX_DAILY_DAYS} days`,
    });
  }
}

/** `GET /admin/analytics/student-growth|enrollments` */
export const analyticsRangeQuerySchema = z.object(rangeFields).superRefine(checkRange);

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;

/** Ranked/paginated analytics (popular courses, completion, exams, faculty). */
export const analyticsPageQuerySchema = paginationQuerySchema
  .extend({ ...rangeFields, courseId: z.uuid().optional(), q: searchQuerySchema })
  .superRefine(checkRange);

export type AnalyticsPageQuery = z.infer<typeof analyticsPageQuerySchema>;

/** `GET /admin/analytics/revenue` — one payment mode at a time. */
export const revenueAnalyticsQuerySchema = z
  .object({ ...rangeFields, mode: z.enum(PAYMENT_MODES).optional() })
  .superRefine(checkRange);

export type RevenueAnalyticsQuery = z.infer<typeof revenueAnalyticsQuerySchema>;

// --- Users ------------------------------------------------------------------------------------

export const DIRECTORY_ROLES = ['STUDENT', 'FACULTY', 'ADMIN'] as const;
export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

/** `GET /admin/users` — `role` is required: each directory has its own permission. */
export const adminUserListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(DIRECTORY_ROLES),
  q: searchQuerySchema,
  status: z.enum(USER_STATUSES).optional(),
  /** Students only. */
  classId: z.uuid().optional(),
  /** Students only: has at least one ACTIVE enrolment (`active`) or none (`none`). */
  enrollment: z.enum(['active', 'none']).optional(),
  sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

/** `PATCH /admin/users/:id/status` */
export const adminUserStatusSchema = z
  .object({
    status: z.enum(USER_STATUSES),
    /** Recorded in the audit log (not shown to the user). */
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;

/** Role key format (matches CHECK `roles_key_format`). */
export const roleKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,49}$/, 'Invalid role');

/** `POST /admin/users/:id/roles` */
export const adminUserRoleGrantSchema = z.object({ role: roleKeySchema }).strict();

export type AdminUserRoleGrantInput = z.infer<typeof adminUserRoleGrantSchema>;

// --- Audit logs -------------------------------------------------------------------------------

export const AUDIT_SOURCES = ['admin', 'payment', 'assessment'] as const;

/** `GET /admin/audit-logs` */
export const adminAuditLogQuerySchema = paginationQuerySchema.extend({
  source: z.enum(AUDIT_SOURCES).default('admin'),
  /** Exact action, e.g. "user.status_changed", or a prefix ending in "." ("course."). */
  action: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z_.]*$/, 'Use lower-case letters, "_" and "."')
    .optional()
    .transform((value) => (value ? value : undefined)),
  actorId: z.uuid().optional(),
  entityId: z.uuid().optional(),
  from: calendarDaySchema.optional(),
  to: calendarDaySchema.optional(),
});

export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;

// --- Operational lists ------------------------------------------------------------------------

/** `GET /admin/enrollments` — every course. */
export const adminGlobalEnrollmentQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  courseId: z.uuid().optional(),
  status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
  source: z.enum(['FREE', 'ADMIN', 'PAYMENT']).optional(),
  completed: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  from: calendarDaySchema.optional(),
  to: calendarDaySchema.optional(),
});

export type AdminGlobalEnrollmentQuery = z.infer<typeof adminGlobalEnrollmentQuerySchema>;

export const NOTIFICATION_DELIVERY_STATUSES = [
  'PENDING',
  'SENDING',
  'ACCEPTED',
  'FAILED',
  'SKIPPED',
] as const;

/** `GET /admin/notifications/deliveries` */
export const adminNotificationDeliveryQuerySchema = paginationQuerySchema.extend({
  status: z.enum(NOTIFICATION_DELIVERY_STATUSES).optional(),
  q: searchQuerySchema,
});

export type AdminNotificationDeliveryQuery = z.infer<typeof adminNotificationDeliveryQuerySchema>;

/** `GET /admin/assessments/assignments|quizzes|exams` */
export const adminAssessmentListQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  courseId: z.uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']).optional(),
  /** Only items with work waiting for faculty (submissions or written answers to grade). */
  pending: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type AdminAssessmentListQuery = z.infer<typeof adminAssessmentListQuerySchema>;
