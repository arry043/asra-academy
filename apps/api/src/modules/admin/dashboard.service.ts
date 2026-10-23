import {
  ANALYTICS_TIME_ZONE,
  PERMISSIONS,
  type AdminDashboardDto,
  type DashboardKpis,
  type PaymentMode,
} from '@asra/types';
import { prisma } from '../../database/prisma.js';
import { clock } from '../../lib/clock.js';
import type { AuthContext } from '../../types/auth.js';
import { paymentsAdminService } from '../payments/admin.service.js';
import { paymentsConfig } from '../payments/config.js';
import { analyticsService } from './analytics.service.js';
import { auditLogService } from './audit.js';

/**
 * `GET /admin/dashboard` (PHASE 12, docs/ADMIN-DASHBOARD.md §3). One request, a fixed number of
 * aggregate queries. The route requires `analytics.view`; each section that exposes more than
 * counts needs its own permission and is `null` without it (computed server-side, never sent).
 * Definitions of every KPI are on the DTO (packages/types/src/admin.ts).
 */

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const LIST_SIZE = 5;

const STUDENT = { roles: { some: { role: { key: 'STUDENT' } } } } as const;
const FACULTY = { roles: { some: { role: { key: 'FACULTY' } } } } as const;

/** A class has not ended yet: start + duration is still in the future. */
const notEndedSql = (now: Date) =>
  prisma.$queryRaw<{ upcoming: number; next7: number; meetingErrors: number }[]>`
    SELECT count(*)::int AS "upcoming",
      count(*) FILTER (WHERE l."starts_at" < ${new Date(now.getTime() + 7 * DAY_MS)})::int AS "next7",
      count(*) FILTER (WHERE l."meeting_last_error" IS NOT NULL AND l."join_url" IS NULL)::int AS "meetingErrors"
    FROM "live_class_sessions" l
    WHERE l."status" = 'SCHEDULED'
      AND l."starts_at" + make_interval(mins => l."duration_minutes") > ${now}`;

async function kpis(auth: AuthContext, now: Date): Promise<DashboardKpis> {
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const previousStart = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY_MS);
  const can = (permission: string) => auth.permissions.has(permission);
  const mode: PaymentMode = paymentsConfig.activeMode() ?? 'LIVE';

  const [
    students,
    activeStudents,
    newStudents,
    previousStudents,
    faculty,
    activeFaculty,
    courses,
    enrollments,
    activeEnrollments,
    newEnrollments,
    previousEnrollments,
    classes,
    submissionsAwaitingReview,
    attemptsAwaitingGrading,
    examsUpcoming,
    examsOpen,
    examsAwaitingResults,
  ] = await Promise.all([
    prisma.user.count({ where: STUDENT }),
    prisma.user.count({ where: { ...STUDENT, status: 'ACTIVE' } }),
    prisma.user.count({ where: { ...STUDENT, createdAt: { gte: windowStart, lte: now } } }),
    prisma.user.count({
      where: { ...STUDENT, createdAt: { gte: previousStart, lt: windowStart } },
    }),
    prisma.user.count({ where: FACULTY }),
    prisma.user.count({ where: { ...FACULTY, status: 'ACTIVE' } }),
    prisma.course.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: windowStart, lte: now } } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: previousStart, lt: windowStart } } }),
    notEndedSql(now),
    prisma.assignmentSubmission.count({ where: { status: 'SUBMITTED' } }),
    prisma.assessmentAttempt.count({ where: { evaluationStatus: 'PENDING' } }),
    prisma.examination.count({ where: { status: 'PUBLISHED', opensAt: { gt: now } } }),
    prisma.examination.count({
      where: { status: 'PUBLISHED', opensAt: { lte: now }, closesAt: { gt: now } },
    }),
    prisma.examination.count({
      where: {
        status: { in: ['PUBLISHED', 'CLOSED'] },
        closesAt: { lte: now },
        resultsPublishedAt: null,
      },
    }),
  ]);

  let revenue: DashboardKpis['revenue'] = null;
  if (can(PERMISSIONS.PAYMENTS_VIEW)) {
    const [allTime, current, previous] = await Promise.all([
      paymentsAdminService.summary({ mode }),
      analyticsService.moneyTotals(mode, windowStart, now),
      analyticsService.moneyTotals(mode, previousStart, windowStart),
    ]);
    const currencies = [...new Set([...current, ...previous].map((row) => row.currency))].sort();
    revenue = {
      mode,
      totals: allTime.totals,
      last30Days: currencies.map((currency) => ({
        currency,
        currentNetMinor: current.find((row) => row.currency === currency)?.netMinor ?? 0,
        previousNetMinor: previous.find((row) => row.currency === currency)?.netMinor ?? 0,
      })),
    };
  }

  const byStatus = (status: string) =>
    courses.find((row) => row.status === status)?._count._all ?? 0;
  const live = classes[0] ?? { upcoming: 0, next7: 0 };
  return {
    students: {
      total: students,
      active: activeStudents,
      registrations: { days: WINDOW_DAYS, current: newStudents, previous: previousStudents },
    },
    faculty: { total: faculty, active: activeFaculty },
    courses: {
      total: courses.reduce((sum, row) => sum + row._count._all, 0),
      published: byStatus('PUBLISHED'),
      draft: byStatus('DRAFT'),
      archived: byStatus('ARCHIVED'),
    },
    enrollments: {
      total: enrollments,
      active: activeEnrollments,
      newEnrollments: { days: WINDOW_DAYS, current: newEnrollments, previous: previousEnrollments },
    },
    revenue,
    liveClasses: { upcoming: live.upcoming, next7Days: live.next7 },
    pendingWork: { submissionsAwaitingReview, attemptsAwaitingGrading },
    examinations: {
      upcoming: examsUpcoming,
      open: examsOpen,
      awaitingResults: examsAwaitingResults,
    },
  };
}

export const dashboardService = {
  async get(auth: AuthContext): Promise<AdminDashboardDto> {
    const now = clock.now();
    const can = (permission: string) => auth.permissions.has(permission);
    const mode: PaymentMode = paymentsConfig.activeMode() ?? 'LIVE';
    const canPayments = can(PERMISSIONS.PAYMENTS_VIEW);
    const canLive = can(PERMISSIONS.LIVE_CLASSES_MANAGE);

    const [
      kpiData,
      classes,
      recentStudents,
      recentOrders,
      upcomingLiveClasses,
      pendingReviews,
      upcomingExams,
      recentActivity,
      failedEmails,
      paymentsNeedingReview,
      failedPaymentsLast7Days,
    ] = await Promise.all([
      kpis(auth, now),
      notEndedSql(now),
      can(PERMISSIONS.STUDENTS_MANAGE)
        ? prisma.user.findMany({
            where: STUDENT,
            select: { id: true, fullName: true, email: true, status: true, createdAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: LIST_SIZE,
          })
        : null,
      canPayments
        ? paymentsAdminService
            .orders({ mode, page: 1, pageSize: LIST_SIZE, q: undefined })
            .then((page) => page.items)
        : null,
      prisma.$queryRaw<
        {
          id: string;
          title: string;
          courseId: string;
          courseTitle: string;
          host: string | null;
          startsAt: Date;
          durationMinutes: number;
          timeZone: string;
          hasJoinLink: boolean;
          meetingLastError: string | null;
        }[]
      >`
        SELECT l."id", l."title", c."id" AS "courseId", c."title" AS "courseTitle",
          u."full_name" AS "host", l."starts_at" AS "startsAt",
          l."duration_minutes" AS "durationMinutes", l."time_zone" AS "timeZone",
          (l."join_url" IS NOT NULL) AS "hasJoinLink", l."meeting_last_error" AS "meetingLastError"
        FROM "live_class_sessions" l
        JOIN "courses" c ON c."id" = l."course_id"
        LEFT JOIN "faculty_profiles" fp ON fp."id" = l."host_faculty_profile_id"
        LEFT JOIN "users" u ON u."id" = fp."user_id"
        WHERE l."status" = 'SCHEDULED'
          AND l."starts_at" + make_interval(mins => l."duration_minutes") > ${now}
        ORDER BY l."starts_at" ASC, l."id" ASC
        LIMIT ${LIST_SIZE}`,
      prisma.assignmentSubmission.findMany({
        where: { status: 'SUBMITTED' },
        select: {
          id: true,
          submittedAt: true,
          late: true,
          assignment: {
            select: {
              lesson: {
                select: {
                  title: true,
                  chapter: {
                    select: {
                      module: { select: { course: { select: { id: true, title: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: LIST_SIZE,
      }),
      prisma.examination.findMany({
        where: { status: 'PUBLISHED', closesAt: { gt: now } },
        select: {
          id: true,
          title: true,
          opensAt: true,
          closesAt: true,
          course: { select: { id: true, title: true } },
        },
        orderBy: [{ opensAt: 'asc' }, { id: 'asc' }],
        take: LIST_SIZE,
      }),
      can(PERMISSIONS.AUDIT_LOGS_VIEW) ? auditLogService.recent(LIST_SIZE) : null,
      can(PERMISSIONS.NOTIFICATIONS_VIEW)
        ? prisma.notificationDelivery.count({ where: { status: 'FAILED' } })
        : null,
      canPayments
        ? prisma.payment.count({ where: { mode, status: 'CAPTURED', reviewReason: { not: null } } })
        : null,
      canPayments
        ? prisma.payment.count({
            where: {
              mode,
              status: 'FAILED',
              failedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
            },
          })
        : null,
    ]);

    return {
      generatedAt: now.toISOString(),
      timeZone: ANALYTICS_TIME_ZONE,
      kpis: kpiData,
      attention: {
        failedEmails,
        paymentsNeedingReview,
        failedPaymentsLast7Days,
        liveClassesWithMeetingErrors: canLive ? (classes[0]?.meetingErrors ?? 0) : null,
      },
      recentStudents:
        recentStudents?.map((row) => ({
          userId: row.id,
          fullName: row.fullName,
          email: row.email,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        })) ?? null,
      recentOrders,
      upcomingLiveClasses: upcomingLiveClasses.map((row) => ({
        id: row.id,
        title: row.title,
        course: { id: row.courseId, title: row.courseTitle },
        host: row.host,
        startsAt: row.startsAt.toISOString(),
        durationMinutes: row.durationMinutes,
        timeZone: row.timeZone,
        hasJoinLink: row.hasJoinLink,
        meetingLastError: canLive ? row.meetingLastError : null,
      })),
      pendingReviews: pendingReviews.map((row) => ({
        submissionId: row.id,
        assignmentTitle: row.assignment.lesson.title,
        course: row.assignment.lesson.chapter.module.course,
        submittedAt: row.submittedAt.toISOString(),
        late: row.late,
      })),
      upcomingExams: upcomingExams.map((row) => ({
        id: row.id,
        title: row.title,
        course: row.course,
        opensAt: row.opensAt.toISOString(),
        closesAt: row.closesAt.toISOString(),
      })),
      recentActivity,
    };
  },
};
