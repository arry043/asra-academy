import {
  ANALYTICS_TIME_ZONE,
  type CompletionAnalyticsDto,
  type CurrencyTotalsDto,
  type EnrollmentAnalyticsDto,
  type EnrollmentBreakdownRow,
  type EnrollmentSource,
  type ExamAnalyticsDto,
  type FacultyPerformanceRow,
  type PaginatedAnalytics,
  type PaymentMode,
  type PaymentStatus,
  type PopularCourseRow,
  type PublicationStatus,
  type AssessmentStatus,
  type RevenueAnalyticsDto,
  type RevenueSeriesPoint,
  type StudentGrowthDto,
  type UserStatus,
} from '@asra/types';
import type {
  AnalyticsPageQuery,
  AnalyticsRangeQuery,
  RevenueAnalyticsQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { pageArgs } from '../../utils/pagination.js';
import { paymentsConfig } from '../payments/config.js';
import {
  bucketStarts,
  fillSeries,
  percent,
  publicRange,
  resolveRange,
  type ResolvedRange,
} from './range.js';

/**
 * Analytics (PHASE 12, docs/ADMIN-DASHBOARD.md §4). Every figure is aggregated by PostgreSQL —
 * no table is loaded into memory — and every definition below matches the documentation. Each
 * report runs a fixed number of queries whatever the page size (no per-row queries).
 *
 * Conventions:
 *  - Days and buckets are calendar days in Asia/Kolkata (range.ts).
 *  - "Student" = an account holding the STUDENT role. Registration time = `users.created_at`.
 *  - "New enrolment" = an enrolment whose latest activation (`enrolled_at`) is in the range.
 *    Reactivating a cancelled enrolment reuses its row and moves `enrolled_at` (docs/STUDENT-LMS),
 *    so each student/course pair is counted once, at its latest activation.
 *  - Money is integer minor units summed in SQL (bigint) — never floating point — per currency
 *    and per payment mode.
 */

const zone = ANALYTICS_TIME_ZONE;

/** `YYYY-MM-DD` of the bucket that contains `column`, in the analytics zone. */
function bucketOf(column: Prisma.Sql, range: ResolvedRange): Prisma.Sql {
  return Prisma.sql`to_char(date_trunc(${range.granularity}, ${column} AT TIME ZONE ${zone}), 'YYYY-MM-DD')`;
}

const isStudent = Prisma.sql`EXISTS (
  SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
  WHERE ur."user_id" = u."id" AND r."key" = 'STUDENT')`;

/** ILIKE pattern with the user's `%`, `_` and `\` taken literally. */
function contains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** bigint/numeric aggregates arrive as bigint or Decimal; money stays exact up to 2^53 paise. */
function toNumber(value: bigint | number | Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return value.toNumber();
}

function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function pagination(total: number, query: { page: number; pageSize: number }) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** A range only when the caller asked for one (completion and exams default to all time). */
function optionalRange(query: AnalyticsPageQuery): ResolvedRange | null {
  return query.from || query.to ? resolveRange(query, clock.now()) : null;
}

const defaultMode = (mode?: PaymentMode): PaymentMode =>
  mode ?? paymentsConfig.activeMode() ?? 'LIVE';

async function count(sql: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>(sql);
  return rows[0]?.n ?? 0;
}

// --- Student growth -------------------------------------------------------------------------

async function studentGrowth(query: AnalyticsRangeQuery): Promise<StudentGrowthDto> {
  const range = resolveRange(query, clock.now());
  const [rows, previousTotal, allTime] = await Promise.all([
    prisma.$queryRaw<{ period: string; value: number }[]>`
      SELECT ${bucketOf(Prisma.sql`u."created_at"`, range)} AS "period", count(*)::int AS "value"
      FROM "users" u
      WHERE u."created_at" >= ${range.start} AND u."created_at" < ${range.end} AND ${isStudent}
      GROUP BY 1`,
    count(Prisma.sql`SELECT count(*)::int AS "n" FROM "users" u
      WHERE u."created_at" >= ${range.previousStart} AND u."created_at" < ${range.previousEnd}
        AND ${isStudent}`),
    count(Prisma.sql`SELECT count(*)::int AS "n" FROM "users" u WHERE ${isStudent}`),
  ]);
  const series = fillSeries(range, rows);
  return {
    range: publicRange(range),
    series,
    total: series.reduce((sum, point) => sum + point.value, 0),
    previousTotal,
    allTime,
  };
}

// --- Enrolments -----------------------------------------------------------------------------

interface BreakdownSqlRow {
  id: string | null;
  label: string | null;
  newEnrollments: number;
  stillActive: number;
}

async function enrollmentBreakdown(
  range: ResolvedRange,
  join: Prisma.Sql,
  key: Prisma.Sql,
  label: Prisma.Sql,
  emptyLabel: string,
): Promise<EnrollmentBreakdownRow[]> {
  const rows = await prisma.$queryRaw<BreakdownSqlRow[]>`
    SELECT ${key} AS "id", ${label} AS "label",
      count(*)::int AS "newEnrollments",
      count(*) FILTER (WHERE e."status" = 'ACTIVE')::int AS "stillActive"
    FROM "enrollments" e
    JOIN "courses" c ON c."id" = e."course_id"
    ${join}
    WHERE e."enrolled_at" >= ${range.start} AND e."enrolled_at" < ${range.end}
    GROUP BY 1, 2
    ORDER BY 3 DESC, 2 ASC NULLS LAST
    LIMIT 10`;
  return rows.map((row) => ({
    id: row.id,
    label: row.label ?? emptyLabel,
    newEnrollments: row.newEnrollments,
    stillActive: row.stillActive,
  }));
}

async function enrollments(query: AnalyticsRangeQuery): Promise<EnrollmentAnalyticsDto> {
  const range = resolveRange(query, clock.now());
  const inRange = { enrolledAt: { gte: range.start, lt: range.end } };
  const [rows, previousTotal, activeNow, bySource, byCourse, byClass, bySubject] =
    await Promise.all([
      prisma.$queryRaw<{ period: string; value: number }[]>`
        SELECT ${bucketOf(Prisma.sql`e."enrolled_at"`, range)} AS "period", count(*)::int AS "value"
        FROM "enrollments" e
        WHERE e."enrolled_at" >= ${range.start} AND e."enrolled_at" < ${range.end}
        GROUP BY 1`,
      prisma.enrollment.count({
        where: { enrolledAt: { gte: range.previousStart, lt: range.previousEnd } },
      }),
      prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
      prisma.enrollment.groupBy({ by: ['source'], where: inRange, _count: { _all: true } }),
      enrollmentBreakdown(range, Prisma.empty, Prisma.sql`c."id"`, Prisma.sql`c."title"`, ''),
      enrollmentBreakdown(
        range,
        Prisma.sql`LEFT JOIN "classes" cl ON cl."id" = c."class_id"`,
        Prisma.sql`cl."id"`,
        Prisma.sql`cl."name"`,
        'No class (special courses)',
      ),
      enrollmentBreakdown(
        range,
        Prisma.sql`LEFT JOIN "subjects" sj ON sj."id" = c."subject_id"`,
        Prisma.sql`sj."id"`,
        Prisma.sql`sj."name"`,
        'No subject',
      ),
    ]);
  const series = fillSeries(range, rows);
  const SOURCES: EnrollmentSource[] = ['PAYMENT', 'FREE', 'ADMIN'];
  return {
    range: publicRange(range),
    series,
    total: series.reduce((sum, point) => sum + point.value, 0),
    previousTotal,
    activeNow,
    bySource: SOURCES.map((source) => ({
      source,
      count: bySource.find((row) => row.source === source)?._count._all ?? 0,
    })),
    byCourse,
    byClass,
    bySubject,
  };
}

// --- Popular courses ------------------------------------------------------------------------

async function popularCourses(
  query: AnalyticsPageQuery,
): Promise<PaginatedAnalytics<PopularCourseRow>> {
  const range = resolveRange(query, clock.now());
  const { skip, take } = pageArgs(query);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      title: string;
      status: PublicationStatus;
      newEnrollments: number;
      activeEnrollments: number;
      totalEnrollments: number;
      completedEnrollments: number;
      totalRows: number;
    }[]
  >`
    WITH stats AS (
      SELECT e."course_id",
        count(*) FILTER (WHERE e."enrolled_at" >= ${range.start} AND e."enrolled_at" < ${range.end})::int AS "newEnrollments",
        count(*) FILTER (WHERE e."status" = 'ACTIVE')::int AS "activeEnrollments",
        count(*)::int AS "totalEnrollments",
        count(*) FILTER (WHERE e."status" = 'ACTIVE' AND e."completed_at" IS NOT NULL)::int AS "completedEnrollments"
      FROM "enrollments" e
      GROUP BY e."course_id"
    )
    SELECT c."id", c."title", c."status", s."newEnrollments", s."activeEnrollments",
      s."totalEnrollments", s."completedEnrollments", (count(*) OVER ())::int AS "totalRows"
    FROM stats s
    JOIN "courses" c ON c."id" = s."course_id"
    WHERE TRUE
      ${query.courseId ? Prisma.sql`AND c."id" = ${query.courseId}::uuid` : Prisma.empty}
      ${query.q ? Prisma.sql`AND c."title" ILIKE ${contains(query.q)}` : Prisma.empty}
    ORDER BY s."newEnrollments" DESC, s."activeEnrollments" DESC, c."title" ASC, c."id" ASC
    LIMIT ${take} OFFSET ${skip}`;
  return {
    range: publicRange(range),
    items: rows.map((row, index) => ({
      rank: skip + index + 1,
      course: { id: row.id, title: row.title, status: row.status },
      newEnrollments: row.newEnrollments,
      activeEnrollments: row.activeEnrollments,
      totalEnrollments: row.totalEnrollments,
      completedEnrollments: row.completedEnrollments,
      completionPercent: percent(row.completedEnrollments, row.activeEnrollments),
    })),
    pagination: pagination(rows[0]?.totalRows ?? 0, query),
  };
}

// --- Revenue --------------------------------------------------------------------------------

interface MoneyRow {
  currency: string;
  amount: bigint | number | null;
  n?: number;
}

async function moneyTotals(
  mode: PaymentMode,
  start: Date,
  end: Date,
): Promise<CurrencyTotalsDto[]> {
  const [captured, refunded] = await Promise.all([
    prisma.$queryRaw<MoneyRow[]>`
      SELECT p."currency", sum(p."amount_minor") AS "amount", count(*)::int AS "n"
      FROM "payments" p
      WHERE p."mode" = ${mode}::"payment_mode" AND p."status" = 'CAPTURED'
        AND p."captured_at" >= ${start} AND p."captured_at" < ${end}
      GROUP BY 1`,
    prisma.$queryRaw<MoneyRow[]>`
      SELECT r."currency", sum(r."amount_minor") AS "amount"
      FROM "refunds" r
      WHERE r."mode" = ${mode}::"payment_mode" AND r."status" = 'PROCESSED'
        AND r."processed_at" >= ${start} AND r."processed_at" < ${end}
      GROUP BY 1`,
  ]);
  const currencies = new Set([...captured, ...refunded].map((row) => row.currency));
  return [...currencies].sort().map((currency) => {
    const gross = captured.find((row) => row.currency === currency);
    const grossCapturedMinor = toNumber(gross?.amount);
    const refundedMinor = toNumber(refunded.find((row) => row.currency === currency)?.amount);
    return {
      currency,
      grossCapturedMinor,
      refundedMinor,
      netMinor: grossCapturedMinor - refundedMinor,
      capturedPaymentCount: gross?.n ?? 0,
    };
  });
}

/**
 * Definitions (cash basis, by the date the money moved):
 *  - gross    = Σ payments CAPTURED in the range (each provider payment is one row — unique
 *               provider id — so duplicate webhooks/reconciliations can never count it twice);
 *  - refunded = Σ refunds PROCESSED in the range (partial refunds are their own rows);
 *  - net      = gross − refunded, before Razorpay fees and taxes (unknown to the platform).
 * Orders, redirects and AUTHORIZED/FAILED attempts never count as revenue. One mode only.
 */
async function revenue(query: RevenueAnalyticsQuery): Promise<RevenueAnalyticsDto> {
  const range = resolveRange(query, clock.now());
  const mode = defaultMode(query.mode);
  const modeSql = Prisma.sql`${mode}::"payment_mode"`;
  const [
    totals,
    previousTotals,
    grossSeries,
    refundSeries,
    courseGross,
    courseRefunds,
    statuses,
    failedPayments,
    pendingOrders,
  ] = await Promise.all([
    moneyTotals(mode, range.start, range.end),
    moneyTotals(mode, range.previousStart, range.previousEnd),
    prisma.$queryRaw<{ period: string; currency: string; amount: bigint }[]>`
        SELECT ${bucketOf(Prisma.sql`p."captured_at"`, range)} AS "period", p."currency",
          sum(p."amount_minor") AS "amount"
        FROM "payments" p
        WHERE p."mode" = ${modeSql} AND p."status" = 'CAPTURED'
          AND p."captured_at" >= ${range.start} AND p."captured_at" < ${range.end}
        GROUP BY 1, 2`,
    prisma.$queryRaw<{ period: string; currency: string; amount: bigint }[]>`
        SELECT ${bucketOf(Prisma.sql`r."processed_at"`, range)} AS "period", r."currency",
          sum(r."amount_minor") AS "amount"
        FROM "refunds" r
        WHERE r."mode" = ${modeSql} AND r."status" = 'PROCESSED'
          AND r."processed_at" >= ${range.start} AND r."processed_at" < ${range.end}
        GROUP BY 1, 2`,
    prisma.$queryRaw<
      { courseId: string; title: string; currency: string; amount: bigint; n: number }[]
    >`
        SELECT c."id" AS "courseId", c."title", p."currency", sum(p."amount_minor") AS "amount",
          count(*)::int AS "n"
        FROM "payments" p
        JOIN "orders" o ON o."id" = p."order_id"
        JOIN "courses" c ON c."id" = o."course_id"
        WHERE p."mode" = ${modeSql} AND p."status" = 'CAPTURED'
          AND p."captured_at" >= ${range.start} AND p."captured_at" < ${range.end}
        GROUP BY 1, 2, 3`,
    prisma.$queryRaw<{ courseId: string; title: string; currency: string; amount: bigint }[]>`
        SELECT c."id" AS "courseId", c."title", r."currency", sum(r."amount_minor") AS "amount"
        FROM "refunds" r
        JOIN "payments" p ON p."id" = r."payment_id"
        JOIN "orders" o ON o."id" = p."order_id"
        JOIN "courses" c ON c."id" = o."course_id"
        WHERE r."mode" = ${modeSql} AND r."status" = 'PROCESSED'
          AND r."processed_at" >= ${range.start} AND r."processed_at" < ${range.end}
        GROUP BY 1, 2, 3`,
    prisma.payment.groupBy({
      by: ['status'],
      where: { mode, createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    }),
    prisma.payment.count({
      where: { mode, status: 'FAILED', failedAt: { gte: range.start, lt: range.end } },
    }),
    prisma.order.count({
      where: {
        mode,
        status: { in: ['CREATED', 'PENDING'] },
        createdAt: { gte: range.start, lt: range.end },
      },
    }),
  ]);

  const currencies = [
    ...new Set([
      ...totals.map((row) => row.currency),
      ...grossSeries.map((row) => row.currency),
      ...refundSeries.map((row) => row.currency),
    ]),
  ].sort();
  const periods = bucketStarts(range);
  const series = currencies.map((currency) => {
    const gross = new Map(
      grossSeries.filter((r) => r.currency === currency).map((r) => [r.period, toNumber(r.amount)]),
    );
    const refunded = new Map(
      refundSeries
        .filter((r) => r.currency === currency)
        .map((r) => [r.period, toNumber(r.amount)]),
    );
    const points: RevenueSeriesPoint[] = periods.map((period) => {
      const grossMinor = gross.get(period) ?? 0;
      const refundedMinor = refunded.get(period) ?? 0;
      return { period, grossMinor, refundedMinor, netMinor: grossMinor - refundedMinor };
    });
    return { currency, points };
  });

  const byCourseKey = new Map<string, RevenueAnalyticsDto['byCourse'][number]>();
  const keyOf = (courseId: string, currency: string) => `${courseId}|${currency}`;
  for (const row of courseGross) {
    byCourseKey.set(keyOf(row.courseId, row.currency), {
      course: { id: row.courseId, title: row.title },
      currency: row.currency,
      grossMinor: toNumber(row.amount),
      refundedMinor: 0,
      netMinor: toNumber(row.amount),
      capturedPayments: row.n,
    });
  }
  for (const row of courseRefunds) {
    const key = keyOf(row.courseId, row.currency);
    const entry = byCourseKey.get(key) ?? {
      course: { id: row.courseId, title: row.title },
      currency: row.currency,
      grossMinor: 0,
      refundedMinor: 0,
      netMinor: 0,
      capturedPayments: 0,
    };
    entry.refundedMinor = toNumber(row.amount);
    entry.netMinor = entry.grossMinor - entry.refundedMinor;
    byCourseKey.set(key, entry);
  }

  const STATUSES: PaymentStatus[] = ['CAPTURED', 'AUTHORIZED', 'CREATED', 'FAILED'];
  return {
    range: publicRange(range),
    mode,
    currencies,
    totals,
    previousTotals,
    series,
    byCourse: [...byCourseKey.values()]
      .sort((a, b) => b.netMinor - a.netMinor || a.course.title.localeCompare(b.course.title))
      .slice(0, 20),
    paymentStatus: STATUSES.map((status) => ({
      status,
      count: statuses.find((row) => row.status === status)?._count._all ?? 0,
    })),
    failedPayments,
    pendingOrders,
  };
}

// --- Completion -----------------------------------------------------------------------------

/**
 * Denominator: ACTIVE enrolments (students who currently have access) — cancelled enrolments
 * and users who were never enrolled are excluded. Numerator: those with `completedAt` set, which
 * the LMS records the first time every eligible lesson is completed (docs/STUDENT-LMS.md §4).
 */
async function completion(query: AnalyticsPageQuery): Promise<CompletionAnalyticsDto> {
  const range = optionalRange(query);
  const { skip, take } = pageArgs(query);
  const cohort = range
    ? Prisma.sql`AND e."enrolled_at" >= ${range.start} AND e."enrolled_at" < ${range.end}`
    : Prisma.empty;
  const courseFilter = Prisma.sql`
    ${query.courseId ? Prisma.sql`AND c."id" = ${query.courseId}::uuid` : Prisma.empty}
    ${query.q ? Prisma.sql`AND c."title" ILIKE ${contains(query.q)}` : Prisma.empty}`;
  const [rows, overall] = await Promise.all([
    prisma.$queryRaw<
      {
        id: string;
        title: string;
        status: PublicationStatus;
        eligible: number;
        completed: number;
        totalRows: number;
      }[]
    >`
      SELECT c."id", c."title", c."status",
        count(*)::int AS "eligible",
        count(*) FILTER (WHERE e."completed_at" IS NOT NULL)::int AS "completed",
        (count(*) OVER ())::int AS "totalRows"
      FROM "enrollments" e
      JOIN "courses" c ON c."id" = e."course_id"
      WHERE e."status" = 'ACTIVE' ${cohort} ${courseFilter}
      GROUP BY c."id"
      ORDER BY 4 DESC, c."title" ASC, c."id" ASC
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ eligible: number; completed: number }[]>`
      SELECT count(*)::int AS "eligible",
        count(*) FILTER (WHERE e."completed_at" IS NOT NULL)::int AS "completed"
      FROM "enrollments" e
      JOIN "courses" c ON c."id" = e."course_id"
      WHERE e."status" = 'ACTIVE' ${cohort} ${courseFilter}`,
  ]);
  const totals = overall[0] ?? { eligible: 0, completed: 0 };
  return {
    range: range ? publicRange(range) : null,
    overall: { ...totals, completionPercent: percent(totals.completed, totals.eligible) },
    items: rows.map((row) => ({
      course: { id: row.id, title: row.title, status: row.status },
      eligible: row.eligible,
      completed: row.completed,
      completionPercent: percent(row.completed, row.eligible),
    })),
    pagination: pagination(rows[0]?.totalRows ?? 0, query),
  };
}

// --- Exam performance -----------------------------------------------------------------------

/**
 * Per attempt (AC-01: no single "final" mark is derived from several attempts). Only finalized
 * attempts (SUBMITTED or EXPIRED) are counted; scores, averages and pass rates use EVALUATED
 * attempts only — an attempt still waiting for manual grading is reported as pending, never as
 * zero. `percent`/`passed` are the stored results of the assessment engine (negative marking and
 * the exam's pass mark already applied by scoring.ts).
 */
async function exams(query: AnalyticsPageQuery): Promise<ExamAnalyticsDto> {
  const range = optionalRange(query);
  const { skip, take } = pageArgs(query);
  const attemptFilter = Prisma.sql`
    a."examination_id" IS NOT NULL AND a."status" IN ('SUBMITTED', 'EXPIRED')
    ${range ? Prisma.sql`AND a."submitted_at" >= ${range.start} AND a."submitted_at" < ${range.end}` : Prisma.empty}`;
  const examFilter = Prisma.sql`
    x."status" <> 'DRAFT'
    ${query.courseId ? Prisma.sql`AND x."course_id" = ${query.courseId}::uuid` : Prisma.empty}
    ${query.q ? Prisma.sql`AND x."title" ILIKE ${contains(query.q)}` : Prisma.empty}`;

  const [rows, overallRows, buckets] = await Promise.all([
    prisma.$queryRaw<
      {
        id: string;
        title: string;
        status: AssessmentStatus;
        opensAt: Date;
        closesAt: Date;
        resultsPublishedAt: Date | null;
        courseId: string;
        courseTitle: string;
        finalized: number;
        evaluated: number;
        pending: number;
        averagePercent: number | null;
        passed: number;
        totalRows: number;
      }[]
    >`
      SELECT x."id", x."title", x."status", x."opens_at" AS "opensAt", x."closes_at" AS "closesAt",
        x."results_published_at" AS "resultsPublishedAt",
        c."id" AS "courseId", c."title" AS "courseTitle",
        count(a."id")::int AS "finalized",
        count(a."id") FILTER (WHERE a."evaluation_status" = 'EVALUATED')::int AS "evaluated",
        count(a."id") FILTER (WHERE a."evaluation_status" = 'PENDING')::int AS "pending",
        (avg(a."percent") FILTER (WHERE a."evaluation_status" = 'EVALUATED'))::float8 AS "averagePercent",
        count(a."id") FILTER (WHERE a."evaluation_status" = 'EVALUATED' AND a."passed")::int AS "passed",
        (count(*) OVER ())::int AS "totalRows"
      FROM "examinations" x
      JOIN "courses" c ON c."id" = x."course_id"
      LEFT JOIN "assessment_attempts" a ON a."examination_id" = x."id" AND ${attemptFilter}
      WHERE ${examFilter}
      GROUP BY x."id", c."id"
      ORDER BY x."opens_at" DESC, x."id" ASC
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<
      {
        finalized: number;
        evaluated: number;
        pending: number;
        averagePercent: number | null;
        passed: number;
        students: number;
      }[]
    >`
      SELECT count(*)::int AS "finalized",
        count(*) FILTER (WHERE a."evaluation_status" = 'EVALUATED')::int AS "evaluated",
        count(*) FILTER (WHERE a."evaluation_status" = 'PENDING')::int AS "pending",
        (avg(a."percent") FILTER (WHERE a."evaluation_status" = 'EVALUATED'))::float8 AS "averagePercent",
        count(*) FILTER (WHERE a."evaluation_status" = 'EVALUATED' AND a."passed")::int AS "passed",
        count(DISTINCT a."user_id")::int AS "students"
      FROM "assessment_attempts" a
      JOIN "examinations" x ON x."id" = a."examination_id"
      WHERE ${attemptFilter} AND ${examFilter}`,
    prisma.$queryRaw<{ bucket: number; n: number }[]>`
      SELECT LEAST(floor(a."percent" / 10), 9)::int AS "bucket", count(*)::int AS "n"
      FROM "assessment_attempts" a
      JOIN "examinations" x ON x."id" = a."examination_id"
      WHERE ${attemptFilter} AND ${examFilter} AND a."evaluation_status" = 'EVALUATED'
        AND a."percent" IS NOT NULL
      GROUP BY 1`,
  ]);
  const o = overallRows[0] ?? {
    finalized: 0,
    evaluated: 0,
    pending: 0,
    averagePercent: null,
    passed: 0,
    students: 0,
  };
  return {
    range: range ? publicRange(range) : null,
    overall: {
      finalizedAttempts: o.finalized,
      evaluatedAttempts: o.evaluated,
      pendingEvaluation: o.pending,
      averagePercent: round2(o.averagePercent),
      passedAttempts: o.passed,
      passPercent: percent(o.passed, o.evaluated),
      distinctStudents: o.students,
    },
    distribution: Array.from({ length: 10 }, (_, index) => ({
      from: index * 10,
      to: index === 9 ? 100 : index * 10 + 9.99,
      count: buckets.find((row) => row.bucket === index)?.n ?? 0,
    })),
    items: rows.map((row) => ({
      exam: { id: row.id, title: row.title, status: row.status },
      course: { id: row.courseId, title: row.courseTitle },
      opensAt: row.opensAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
      finalizedAttempts: row.finalized,
      evaluatedAttempts: row.evaluated,
      pendingEvaluation: row.pending,
      averagePercent: round2(row.averagePercent),
      passedAttempts: row.passed,
      passPercent: percent(row.passed, row.evaluated),
    })),
    pagination: pagination(rows[0]?.totalRows ?? 0, query),
  };
}

// --- Faculty performance --------------------------------------------------------------------

/**
 * Operational indicators only — counts of recorded work, never a rating. Course scope is the
 * faculty member's CURRENT course assignments (`course_instructors`); activity counts (classes
 * held, submissions graded) use the range; backlog figures are "now".
 */
async function faculty(
  query: AnalyticsPageQuery,
): Promise<PaginatedAnalytics<FacultyPerformanceRow>> {
  const range = resolveRange(query, clock.now());
  const where: Prisma.FacultyProfileWhereInput = {
    user: {
      roles: { some: { role: { key: 'FACULTY' } } },
      ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' } } : {}),
    },
    ...(query.courseId ? { courses: { some: { courseId: query.courseId } } } : {}),
  };
  const { skip, take } = pageArgs(query);
  const [profiles, total] = await Promise.all([
    prisma.facultyProfile.findMany({
      where,
      select: { id: true, userId: true, user: { select: { fullName: true, status: true } } },
      orderBy: [{ user: { fullName: 'asc' } }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.facultyProfile.count({ where }),
  ]);
  const ids = profiles.map((profile) => profile.id);
  const stats =
    ids.length === 0
      ? []
      : await prisma.$queryRaw<
          {
            id: string;
            assignedCourses: number;
            activeStudents: number;
            liveClassesCompleted: number;
            liveClassesCancelled: number;
            submissionsGraded: number;
            medianGradingHours: number | null;
            pendingSubmissions: number;
            pendingAttemptGrading: number;
            activeEnrollments: number;
            completedEnrollments: number;
          }[]
        >`
          SELECT fp."id",
            (SELECT count(*)::int FROM "course_instructors" ci
              WHERE ci."faculty_profile_id" = fp."id") AS "assignedCourses",
            (SELECT count(DISTINCT e."user_id")::int FROM "enrollments" e
              JOIN "course_instructors" ci ON ci."course_id" = e."course_id"
              WHERE ci."faculty_profile_id" = fp."id" AND e."status" = 'ACTIVE') AS "activeStudents",
            (SELECT count(*)::int FROM "live_class_sessions" l
              WHERE l."host_faculty_profile_id" = fp."id" AND l."status" = 'COMPLETED'
                AND l."starts_at" >= ${range.start} AND l."starts_at" < ${range.end}) AS "liveClassesCompleted",
            (SELECT count(*)::int FROM "live_class_sessions" l
              WHERE l."host_faculty_profile_id" = fp."id" AND l."status" = 'CANCELLED'
                AND l."starts_at" >= ${range.start} AND l."starts_at" < ${range.end}) AS "liveClassesCancelled",
            (SELECT count(*)::int FROM "assignment_submissions" s
              WHERE s."graded_by_id" = fp."user_id"
                AND s."graded_at" >= ${range.start} AND s."graded_at" < ${range.end}) AS "submissionsGraded",
            (SELECT (percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch FROM (s."graded_at" - s."submitted_at")) / 3600))::float8
              FROM "assignment_submissions" s
              WHERE s."graded_by_id" = fp."user_id"
                AND s."graded_at" >= ${range.start} AND s."graded_at" < ${range.end}) AS "medianGradingHours",
            (SELECT count(*)::int FROM "assignment_submissions" s
              JOIN "assignments" asg ON asg."id" = s."assignment_id"
              JOIN "lessons" l ON l."id" = asg."lesson_id"
              JOIN "chapters" ch ON ch."id" = l."chapter_id"
              JOIN "modules" m ON m."id" = ch."module_id"
              JOIN "course_instructors" ci ON ci."course_id" = m."course_id"
              WHERE ci."faculty_profile_id" = fp."id" AND s."status" = 'SUBMITTED') AS "pendingSubmissions",
            (SELECT count(*)::int FROM "assessment_attempts" a
              LEFT JOIN "examinations" x ON x."id" = a."examination_id"
              LEFT JOIN "quizzes" q ON q."id" = a."quiz_id"
              LEFT JOIN "lessons" l ON l."id" = q."lesson_id"
              LEFT JOIN "chapters" ch ON ch."id" = l."chapter_id"
              LEFT JOIN "modules" m ON m."id" = ch."module_id"
              JOIN "course_instructors" ci ON ci."course_id" = COALESCE(x."course_id", m."course_id")
              WHERE ci."faculty_profile_id" = fp."id" AND a."evaluation_status" = 'PENDING') AS "pendingAttemptGrading",
            (SELECT count(*)::int FROM "enrollments" e
              JOIN "course_instructors" ci ON ci."course_id" = e."course_id"
              WHERE ci."faculty_profile_id" = fp."id" AND e."status" = 'ACTIVE') AS "activeEnrollments",
            (SELECT count(*)::int FROM "enrollments" e
              JOIN "course_instructors" ci ON ci."course_id" = e."course_id"
              WHERE ci."faculty_profile_id" = fp."id" AND e."status" = 'ACTIVE'
                AND e."completed_at" IS NOT NULL) AS "completedEnrollments"
          FROM "faculty_profiles" fp
          WHERE fp."id" = ANY(${ids}::uuid[])`;
  const byId = new Map(stats.map((row) => [row.id, row]));
  return {
    range: publicRange(range),
    items: profiles.map((profile) => {
      const row = byId.get(profile.id);
      return {
        faculty: {
          facultyProfileId: profile.id,
          userId: profile.userId,
          fullName: profile.user.fullName,
          status: profile.user.status as UserStatus,
        },
        assignedCourses: row?.assignedCourses ?? 0,
        activeStudents: row?.activeStudents ?? 0,
        liveClassesCompleted: row?.liveClassesCompleted ?? 0,
        liveClassesCancelled: row?.liveClassesCancelled ?? 0,
        submissionsGraded: row?.submissionsGraded ?? 0,
        medianGradingHours:
          row?.medianGradingHours === null || row?.medianGradingHours === undefined
            ? null
            : Math.round(row.medianGradingHours * 10) / 10,
        pendingSubmissions: row?.pendingSubmissions ?? 0,
        pendingAttemptGrading: row?.pendingAttemptGrading ?? 0,
        completionPercent: percent(row?.completedEnrollments ?? 0, row?.activeEnrollments ?? 0),
      };
    }),
    pagination: pagination(total, query),
  };
}

export const analyticsService = {
  studentGrowth,
  enrollments,
  popularCourses,
  revenue,
  completion,
  exams,
  faculty,
  /** Shared with the dashboard. */
  moneyTotals,
};
