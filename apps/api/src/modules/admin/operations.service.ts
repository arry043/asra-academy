import type {
  AdminAssignmentItem,
  AdminEnrollmentListItem,
  AdminExamItem,
  AdminNotificationDeliveryItem,
  AdminNotificationSummaryDto,
  AdminQuizItem,
  AssessmentStatus,
  NotificationDeliveryStatus,
  Paginated,
  PublicationStatus,
} from '@asra/types';
import type {
  AdminAssessmentListQuery,
  AdminGlobalEnrollmentQuery,
  AdminNotificationDeliveryQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { zonedDayRange } from './range.js';

/**
 * Cross-course operational lists for administrators (PHASE 12, docs/ADMIN-DASHBOARD.md §6).
 * Read-only: enrolment changes, grading, result release and email retries stay in their own
 * workflows (enrollments.service, the faculty portal, the notification dispatcher), so no
 * business rule is duplicated here. Every list is paginated and aggregated in the database.
 */

const DAY_MS = 86_400_000;

function contains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export const operationsService = {
  /** `GET /admin/enrollments` — enrolments of every course (`enrollments.manage`). */
  async enrollments(
    query: AdminGlobalEnrollmentQuery,
  ): Promise<Paginated<AdminEnrollmentListItem>> {
    const range = zonedDayRange(query.from, query.to);
    const where: Prisma.EnrollmentWhereInput = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.completed === undefined
        ? {}
        : { completedAt: query.completed ? { not: null } : null }),
      ...(range ? { enrolledAt: range } : {}),
      ...(query.q
        ? {
            OR: [
              { user: { fullName: { contains: query.q, mode: 'insensitive' } } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
              { course: { title: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        select: {
          id: true,
          status: true,
          source: true,
          enrolledAt: true,
          cancelledAt: true,
          completedAt: true,
          lastActivityAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          course: { select: { id: true, title: true } },
          order: { select: { reference: true } },
        },
        orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.enrollment.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({
        id: row.id,
        student: { userId: row.user.id, fullName: row.user.fullName, email: row.user.email },
        course: row.course,
        status: row.status,
        source: row.source,
        enrolledAt: row.enrolledAt.toISOString(),
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
        orderReference: row.order?.reference ?? null,
      })),
      total,
      query,
    );
  },

  /**
   * `GET /admin/notifications/deliveries` (`notifications.view`). Shows the event, the recipient's
   * name, the delivery state and the safe error class — never email addresses or message bodies.
   */
  async deliveries(
    query: AdminNotificationDeliveryQuery,
  ): Promise<Paginated<AdminNotificationDeliveryItem>> {
    const where: Prisma.NotificationDeliveryWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            notification: {
              OR: [
                { event: { contains: query.q, mode: 'insensitive' } },
                { title: { contains: query.q, mode: 'insensitive' } },
                { user: { fullName: { contains: query.q, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where,
        select: {
          id: true,
          status: true,
          channel: true,
          attempts: true,
          lastError: true,
          nextAttemptAt: true,
          acceptedAt: true,
          createdAt: true,
          notification: {
            select: {
              type: true,
              event: true,
              title: true,
              user: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.notificationDelivery.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        channel: row.channel,
        attempts: row.attempts,
        lastError: row.lastError,
        nextAttemptAt: row.nextAttemptAt.toISOString(),
        acceptedAt: row.acceptedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        notification: {
          type: row.notification.type,
          event: row.notification.event,
          title: row.notification.title,
        },
        recipient: {
          userId: row.notification.user.id,
          fullName: row.notification.user.fullName,
        },
      })),
      total,
      query,
    );
  },

  async deliverySummary(): Promise<AdminNotificationSummaryDto> {
    const [byStatus, inApp] = await Promise.all([
      prisma.notificationDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.notification.count({
        where: { createdAt: { gte: new Date(clock.now().getTime() - 7 * DAY_MS) } },
      }),
    ]);
    const STATUSES: NotificationDeliveryStatus[] = [
      'PENDING',
      'SENDING',
      'ACCEPTED',
      'FAILED',
      'SKIPPED',
    ];
    return {
      byStatus: STATUSES.map((status) => ({
        status,
        count: byStatus.find((row) => row.status === status)?._count._all ?? 0,
      })),
      inAppLast7Days: inApp,
    };
  },

  /** `GET /admin/assessments/assignments` (`content.manage`). `status` = lesson publication. */
  async assignments(query: AdminAssessmentListQuery): Promise<Paginated<AdminAssignmentItem>> {
    const { skip, take } = pageArgs(query);
    const lessonStatus =
      query.status && query.status !== 'CLOSED' ? (query.status as PublicationStatus) : undefined;
    const rows = await prisma.$queryRaw<
      {
        assignmentId: string;
        lessonId: string;
        title: string;
        lessonStatus: PublicationStatus;
        courseId: string;
        courseTitle: string;
        maxMarks: number;
        dueAt: Date | null;
        submissions: number;
        awaitingReview: number;
        graded: number;
        released: number;
        totalRows: number;
      }[]
    >`
      SELECT a."id" AS "assignmentId", l."id" AS "lessonId", l."title", l."status" AS "lessonStatus",
        c."id" AS "courseId", c."title" AS "courseTitle", a."max_marks" AS "maxMarks", a."due_at" AS "dueAt",
        count(s."id")::int AS "submissions",
        count(s."id") FILTER (WHERE s."status" = 'SUBMITTED')::int AS "awaitingReview",
        count(s."id") FILTER (WHERE s."status" = 'GRADED')::int AS "graded",
        count(s."id") FILTER (WHERE s."result_released_at" IS NOT NULL)::int AS "released",
        (count(*) OVER ())::int AS "totalRows"
      FROM "assignments" a
      JOIN "lessons" l ON l."id" = a."lesson_id"
      JOIN "chapters" ch ON ch."id" = l."chapter_id"
      JOIN "modules" m ON m."id" = ch."module_id"
      JOIN "courses" c ON c."id" = m."course_id"
      LEFT JOIN "assignment_submissions" s ON s."assignment_id" = a."id"
      WHERE TRUE
        ${query.courseId ? Prisma.sql`AND c."id" = ${query.courseId}::uuid` : Prisma.empty}
        ${lessonStatus ? Prisma.sql`AND l."status" = ${lessonStatus}::"publication_status"` : Prisma.empty}
        ${query.q ? Prisma.sql`AND (l."title" ILIKE ${contains(query.q)} OR c."title" ILIKE ${contains(query.q)})` : Prisma.empty}
      GROUP BY a."id", l."id", c."id"
      ${query.pending ? Prisma.sql`HAVING count(s."id") FILTER (WHERE s."status" = 'SUBMITTED') > 0` : Prisma.empty}
      ORDER BY 10 DESC, a."due_at" ASC NULLS LAST, l."title" ASC, a."id" ASC
      LIMIT ${take} OFFSET ${skip}`;
    return paginated(
      rows.map((row) => ({
        assignmentId: row.assignmentId,
        lessonId: row.lessonId,
        title: row.title,
        lessonStatus: row.lessonStatus,
        course: { id: row.courseId, title: row.courseTitle },
        maxMarks: row.maxMarks,
        dueAt: row.dueAt?.toISOString() ?? null,
        submissions: row.submissions,
        awaitingReview: row.awaitingReview,
        graded: row.graded,
        released: row.released,
      })),
      rows[0]?.totalRows ?? 0,
      query,
    );
  },

  /** `GET /admin/assessments/quizzes` (`content.manage`). */
  async quizzes(query: AdminAssessmentListQuery): Promise<Paginated<AdminQuizItem>> {
    const { skip, take } = pageArgs(query);
    const status =
      query.status && query.status !== 'ARCHIVED' ? (query.status as AssessmentStatus) : undefined;
    const rows = await prisma.$queryRaw<
      {
        quizId: string;
        lessonId: string;
        title: string;
        status: AssessmentStatus;
        courseId: string;
        courseTitle: string;
        questionCount: number;
        finalizedAttempts: number;
        pendingEvaluation: number;
        resultsPublishedAt: Date | null;
        totalRows: number;
      }[]
    >`
      SELECT q."id" AS "quizId", l."id" AS "lessonId", l."title", q."status",
        c."id" AS "courseId", c."title" AS "courseTitle",
        (SELECT count(*)::int FROM "assessment_questions" aq WHERE aq."quiz_id" = q."id") AS "questionCount",
        (SELECT count(*)::int FROM "assessment_attempts" at
          WHERE at."quiz_id" = q."id" AND at."status" IN ('SUBMITTED', 'EXPIRED')) AS "finalizedAttempts",
        (SELECT count(*)::int FROM "assessment_attempts" at
          WHERE at."quiz_id" = q."id" AND at."evaluation_status" = 'PENDING') AS "pendingEvaluation",
        q."results_published_at" AS "resultsPublishedAt",
        (count(*) OVER ())::int AS "totalRows"
      FROM "quizzes" q
      JOIN "lessons" l ON l."id" = q."lesson_id"
      JOIN "chapters" ch ON ch."id" = l."chapter_id"
      JOIN "modules" m ON m."id" = ch."module_id"
      JOIN "courses" c ON c."id" = m."course_id"
      WHERE TRUE
        ${query.courseId ? Prisma.sql`AND c."id" = ${query.courseId}::uuid` : Prisma.empty}
        ${status ? Prisma.sql`AND q."status" = ${status}::"assessment_status"` : Prisma.empty}
        ${query.q ? Prisma.sql`AND (l."title" ILIKE ${contains(query.q)} OR c."title" ILIKE ${contains(query.q)})` : Prisma.empty}
        ${query.pending ? Prisma.sql`AND EXISTS (SELECT 1 FROM "assessment_attempts" at WHERE at."quiz_id" = q."id" AND at."evaluation_status" = 'PENDING')` : Prisma.empty}
      ORDER BY q."updated_at" DESC, q."id" ASC
      LIMIT ${take} OFFSET ${skip}`;
    return paginated(
      rows.map((row) => ({
        quizId: row.quizId,
        lessonId: row.lessonId,
        title: row.title,
        status: row.status,
        course: { id: row.courseId, title: row.courseTitle },
        questionCount: row.questionCount,
        finalizedAttempts: row.finalizedAttempts,
        pendingEvaluation: row.pendingEvaluation,
        resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
      })),
      rows[0]?.totalRows ?? 0,
      query,
    );
  },

  /** `GET /admin/assessments/exams` (`content.manage`). */
  async exams(query: AdminAssessmentListQuery): Promise<Paginated<AdminExamItem>> {
    const status =
      query.status && query.status !== 'ARCHIVED' ? (query.status as AssessmentStatus) : undefined;
    const where: Prisma.ExaminationWhereInput = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(status ? { status } : {}),
      ...(query.pending ? { attempts: { some: { evaluationStatus: 'PENDING' } } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { course: { title: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.examination.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          opensAt: true,
          closesAt: true,
          resultsPublishedAt: true,
          course: { select: { id: true, title: true } },
          _count: { select: { questions: true } },
        },
        orderBy: [{ opensAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.examination.count({ where }),
    ]);
    const ids = rows.map((row) => row.id);
    const [finalized, pending] = ids.length
      ? await Promise.all([
          prisma.assessmentAttempt.groupBy({
            by: ['examinationId'],
            where: { examinationId: { in: ids }, status: { in: ['SUBMITTED', 'EXPIRED'] } },
            _count: { _all: true },
          }),
          prisma.assessmentAttempt.groupBy({
            by: ['examinationId'],
            where: { examinationId: { in: ids }, evaluationStatus: 'PENDING' },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const countOf = (
      rows: { examinationId: string | null; _count: { _all: number } }[],
      id: string,
    ) => rows.find((row) => row.examinationId === id)?._count._all ?? 0;
    return paginated(
      rows.map((row) => ({
        examId: row.id,
        title: row.title,
        status: row.status,
        course: row.course,
        opensAt: row.opensAt.toISOString(),
        closesAt: row.closesAt.toISOString(),
        questionCount: row._count.questions,
        finalizedAttempts: countOf(finalized, row.id),
        pendingEvaluation: countOf(pending, row.id),
        resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  },
};
