/**
 * PHASE 12 — Admin dashboard, analytics, user administration and audit logs through the real
 * HTTP API and database. Rows that analytics read (users, enrolments, payments, attempts …) are
 * written directly with exact timestamps, so every metric is checked against a known answer.
 * No external service is reached: payments are plain rows (no Razorpay), no email is sent.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  AdminAuditEntryDto,
  AdminDashboardDto,
  AdminRolesDto,
  AdminUserDetail,
  AdminUserListItem,
  CompletionAnalyticsDto,
  EnrollmentAnalyticsDto,
  ExamAnalyticsDto,
  FacultyPerformanceRow,
  Paginated,
  PaginatedAnalytics,
  PopularCourseRow,
  RevenueAnalyticsDto,
  StudentGrowthDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { setClockForTests } from '../src/lib/clock.js';
import { setPaymentAccountsForTests } from '../src/modules/payments/config.js';
import {
  bucketStarts,
  dayInZone,
  resolveRange,
  zonedDayStart,
} from '../src/modules/admin/range.js';
import { login, PASSWORD, provision, resetAuthState, uniqueEmail } from './support/auth.js';
import {
  apiAs,
  createFaculty,
  createPublishableCourse,
  expectStatus,
  tokenFor,
  type Api,
} from './support/catalog.js';
import { uniqueSuffix } from './support/fixtures.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
let client: TestClient;
let superAdmin: Api;
let admin: Api;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  setClockForTests(null);
  setPaymentAccountsForTests(null);
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(async () => {
  setClockForTests(null);
  // Revenue defaults to the active mode, else LIVE: pin "no checkout configured" → LIVE.
  setPaymentAccountsForTests({ activeMode: null, accounts: {} });
  await resetAuthState();
  client = new TestClient(baseUrl);
  superAdmin = apiAs(client, await tokenFor(client, 'SUPER_ADMIN'));
  admin = apiAs(client, await tokenFor(client, 'ADMIN'));
});

// --- Fixtures -------------------------------------------------------------------------------

async function roleId(key: string) {
  return (await prisma.role.findUniqueOrThrow({ where: { key } })).id;
}

/** A student account created at an exact instant (registration time = users.created_at). */
async function student(createdAt = new Date(), status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
  return prisma.user.create({
    data: {
      email: uniqueEmail('stu'),
      fullName: `Student ${uniqueSuffix()}`,
      status,
      createdAt,
      roles: { create: { roleId: await roleId('STUDENT') } },
      studentProfile: { create: {} },
    },
  });
}

async function course(
  title = `Course ${uniqueSuffix()}`,
  status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED',
) {
  return prisma.course.create({
    data: {
      title,
      slug: `c-${uniqueSuffix()}`,
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  });
}

async function enrol(
  userId: string,
  courseId: string,
  enrolledAt: Date,
  extra: { status?: 'ACTIVE' | 'CANCELLED'; completedAt?: Date | null } = {},
) {
  return prisma.enrollment.create({
    data: {
      userId,
      courseId,
      source: 'ADMIN',
      enrolledAt,
      status: extra.status ?? 'ACTIVE',
      cancelledAt: extra.status === 'CANCELLED' ? enrolledAt : null,
      completedAt: extra.completedAt ?? null,
    },
  });
}

/** A user holding a custom role with exactly these permissions (for escalation tests). */
async function customRoleUser(permissions: string[]) {
  const key = `CUSTOM_${uniqueSuffix()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')}`;
  const role = await prisma.role.create({ data: { key, name: key } });
  const rows = await prisma.permission.findMany({ where: { key: { in: permissions } } });
  await prisma.rolePermission.createMany({
    data: rows.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });
  const email = uniqueEmail('custom');
  const user = await provision('ADMIN', email);
  // Replace the ADMIN role with the custom one.
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  const token = (await login(client, email)).accessToken;
  return { user, api: apiAs(client, token), roleKey: key };
}

async function order(
  userId: string,
  courseId: string,
  mode: 'TEST' | 'LIVE',
  amountMinor: number,
  status: 'PAID' | 'PENDING' = 'PAID',
) {
  return prisma.order.create({
    data: {
      reference: `ASRA-T-${uniqueSuffix()}`,
      userId,
      courseId,
      mode,
      status,
      providerKeyId: `rzp_${mode.toLowerCase()}_x`,
      providerOrderId: `order_${uniqueSuffix()}`,
      currency: 'INR',
      courseTitle: 'Course',
      listPriceMinor: amountMinor,
      amountMinor,
      expiresAt: new Date(Date.now() + 3_600_000),
      paidAt: status === 'PAID' ? new Date() : null,
    },
  });
}

async function payment(
  o: { id: string; userId: string; mode: 'TEST' | 'LIVE'; providerOrderId: string | null },
  status: 'CAPTURED' | 'FAILED',
  amountMinor: number,
  at: Date,
  providerPaymentId = `pay_${uniqueSuffix()}`,
) {
  return prisma.payment.create({
    data: {
      orderId: o.id,
      userId: o.userId,
      mode: o.mode,
      providerPaymentId,
      providerOrderId: o.providerOrderId!,
      status,
      amountMinor,
      currency: 'INR',
      capturedAt: status === 'CAPTURED' ? at : null,
      failedAt: status === 'FAILED' ? at : null,
      createdAt: at,
    },
  });
}

// --- Range helpers (pure) -------------------------------------------------------------------

describe('analytics calendar (Asia/Kolkata)', () => {
  it('uses IST day boundaries, independent of UTC', () => {
    assert.equal(dayInZone(new Date('2026-03-01T18:29:59.999Z')), '2026-03-01');
    assert.equal(dayInZone(new Date('2026-03-01T18:30:00.000Z')), '2026-03-02');
    assert.equal(zonedDayStart('2026-03-02').toISOString(), '2026-03-01T18:30:00.000Z');
  });

  it('defaults to the last 30 days ending today and derives the previous window', () => {
    const range = resolveRange({}, new Date('2026-10-23T20:00:00Z')); // 24 Oct, 01:30 IST
    assert.equal(range.to, '2026-10-24');
    assert.equal(range.from, '2026-09-25');
    assert.equal(range.days, 30);
    assert.equal(range.previousTo, '2026-09-24');
    assert.equal(range.previousFrom, '2026-08-26');
    assert.equal(range.granularity, 'day');
  });

  it('builds Monday-based weeks and calendar months, including empty buckets', () => {
    assert.deepEqual(bucketStarts({ from: '2026-10-01', to: '2026-10-14', granularity: 'week' }), [
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    assert.deepEqual(bucketStarts({ from: '2026-11-15', to: '2027-01-02', granularity: 'month' }), [
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
  });
});

// --- Authorization --------------------------------------------------------------------------

describe('admin endpoints authorization', () => {
  const paths = [
    '/admin/dashboard',
    '/admin/analytics/student-growth',
    '/admin/analytics/enrollments',
    '/admin/analytics/popular-courses',
    '/admin/analytics/revenue',
    '/admin/analytics/completion',
    '/admin/analytics/exams',
    '/admin/analytics/faculty',
    '/admin/users?role=STUDENT',
    '/admin/roles',
    '/admin/audit-logs',
    '/admin/enrollments',
    '/admin/notifications/deliveries',
    '/admin/assessments/exams',
  ];

  it('rejects anonymous callers (401), students and faculty (403)', async () => {
    const studentApi = apiAs(client, await tokenFor(client, 'STUDENT'));
    const facultyApi = apiAs(client, await tokenFor(client, 'FACULTY'));
    for (const path of paths) {
      expectStatus(await apiAs(client, undefined)('GET', path), 401);
      expectStatus(await studentApi('GET', path), 403);
      expectStatus(await facultyApi('GET', path), 403);
    }
  });

  it('gives ADMIN the academy views but not Super Admin areas', async () => {
    for (const path of paths.filter((p) => !['/admin/roles', '/admin/audit-logs'].includes(p))) {
      expectStatus(await admin('GET', path), 200);
    }
    expectStatus(await admin('GET', '/admin/roles'), 403);
    expectStatus(await admin('GET', '/admin/audit-logs'), 403);
    expectStatus(await admin('GET', '/admin/users?role=ADMIN'), 403);
  });

  it('requires payments.view for revenue, on the route and inside the dashboard', async () => {
    const analyst = await customRoleUser(['analytics.view']);
    expectStatus(await analyst.api('GET', '/admin/analytics/revenue'), 403);
    const dashboard = await analyst.api<AdminDashboardDto>('GET', '/admin/dashboard');
    expectStatus(dashboard, 200);
    assert.equal(dashboard.body.data.kpis.revenue, null);
    assert.equal(dashboard.body.data.recentOrders, null);
    assert.equal(dashboard.body.data.recentStudents, null, 'student PII needs students.manage');
    assert.equal(dashboard.body.data.recentActivity, null, 'audit needs audit_logs.view');
  });

  it('validates date filters', async () => {
    const growth = (q: string) => admin('GET', `/admin/analytics/student-growth?${q}`);
    expectStatus(await growth('from=2026-05-02&to=2026-05-01'), 422);
    expectStatus(await growth('from=2024-01-01&to=2026-06-01'), 422);
    expectStatus(await growth('from=2025-01-01&to=2026-06-01&granularity=day'), 422);
    expectStatus(await growth('from=2026-02-30&to=2026-03-02'), 422);
    expectStatus(await growth('from=2026-01-01&to=2026-06-01&granularity=week'), 200);
  });
});

// --- Dashboard ------------------------------------------------------------------------------

describe('GET /admin/dashboard', () => {
  it('renders an empty platform with zeros and empty lists', async () => {
    const res = await superAdmin<AdminDashboardDto>('GET', '/admin/dashboard');
    expectStatus(res, 200);
    const d = res.body.data;
    assert.equal(d.kpis.students?.total, 0);
    assert.equal(d.kpis.courses?.total, 0);
    assert.equal(d.kpis.enrollments?.total, 0);
    assert.deepEqual(d.kpis.revenue?.totals, []);
    assert.equal(d.kpis.revenue?.mode, 'LIVE');
    assert.deepEqual(d.upcomingLiveClasses, []);
    assert.deepEqual(d.pendingReviews, []);
    assert.deepEqual(d.recentStudents, []);
    assert.equal(d.attention.failedEmails, 0);
  });

  it('KPI counts match the database', async () => {
    const now = new Date();
    const day = 86_400_000;
    const s1 = await student(new Date(now.getTime() - 2 * day));
    const s2 = await student(new Date(now.getTime() - 40 * day), 'SUSPENDED');
    await student(new Date(now.getTime() - 100 * day));
    await createFaculty();
    const c1 = await course();
    await course(undefined, 'DRAFT');
    await enrol(s1.id, c1.id, new Date(now.getTime() - day));
    await enrol(s2.id, c1.id, new Date(now.getTime() - 45 * day), { status: 'CANCELLED' });

    const d = (await superAdmin<AdminDashboardDto>('GET', '/admin/dashboard')).body.data;
    const studentRole = { roles: { some: { role: { key: 'STUDENT' } } } };
    assert.equal(d.kpis.students?.total, await prisma.user.count({ where: studentRole }));
    assert.equal(d.kpis.students?.total, 3);
    assert.equal(d.kpis.students?.active, 2);
    assert.deepEqual(d.kpis.students?.registrations, { days: 30, current: 1, previous: 1 });
    // The faculty account comes from createFaculty; tokenFor accounts are ADMIN/SUPER_ADMIN.
    assert.equal(d.kpis.faculty?.total, 1);
    assert.deepEqual(
      {
        total: d.kpis.courses?.total,
        published: d.kpis.courses?.published,
        draft: d.kpis.courses?.draft,
      },
      { total: 2, published: 1, draft: 1 },
    );
    assert.equal(d.kpis.enrollments?.total, 2);
    assert.equal(d.kpis.enrollments?.active, 1);
    assert.deepEqual(d.kpis.enrollments?.newEnrollments, { days: 30, current: 1, previous: 1 });
    assert.equal(d.recentStudents?.[0]?.userId, s1.id);
  });
});

// --- Student growth -------------------------------------------------------------------------

describe('GET /admin/analytics/student-growth', () => {
  it('counts student accounts by registration time on IST day boundaries', async () => {
    await student(new Date('2026-03-01T18:29:59.999Z')); // 1 Mar, 23:59 IST
    await student(new Date('2026-03-01T18:30:00.000Z')); // 2 Mar, 00:00 IST
    await student(new Date('2026-03-02T12:00:00.000Z')); // 2 Mar
    await student(new Date('2026-02-28T10:00:00.000Z')); // previous window (1 day before)
    // A faculty account created in range is not a student.
    const f = await createFaculty();
    await prisma.user.update({
      where: { id: f.user.id },
      data: { createdAt: new Date('2026-03-02T05:00:00Z') },
    });
    // An old student who enrols in range does not count as a registration.
    const old = await student(new Date('2025-01-01T00:00:00Z'));
    await enrol(old.id, (await course()).id, new Date('2026-03-02T06:00:00Z'));

    const res = await admin<StudentGrowthDto>(
      'GET',
      '/admin/analytics/student-growth?from=2026-03-02&to=2026-03-02',
    );
    expectStatus(res, 200);
    assert.equal(res.body.data.total, 2);
    assert.deepEqual(res.body.data.series, [{ period: '2026-03-02', value: 2 }]);
    assert.equal(res.body.data.previousTotal, 1, 'the 1 Mar 23:59 IST account');
    assert.equal(res.body.data.allTime, 5);
    assert.equal(res.body.data.range.timeZone, 'Asia/Kolkata');
  });
});

// --- Enrolments & popular courses -----------------------------------------------------------

describe('enrolment analytics', () => {
  it('distinguishes new enrolments in the range from enrolments active now', async () => {
    const [a, b, c] = await Promise.all([student(), student(), student()]);
    const course1 = await course('Algebra');
    const course2 = await course('Biology');
    const inRange = new Date('2026-05-10T06:00:00Z');
    await enrol(a.id, course1.id, inRange);
    await enrol(b.id, course1.id, inRange, { status: 'CANCELLED' });
    await enrol(c.id, course2.id, new Date('2026-01-10T06:00:00Z')); // before the range

    const res = await admin<EnrollmentAnalyticsDto>(
      'GET',
      '/admin/analytics/enrollments?from=2026-05-01&to=2026-05-31',
    );
    expectStatus(res, 200);
    const d = res.body.data;
    assert.equal(d.total, 2);
    assert.equal(d.activeNow, 2, 'a (in range) and c (older) are active now');
    assert.deepEqual(
      d.byCourse.map((row) => [row.label, row.newEnrollments, row.stillActive]),
      [['Algebra', 2, 1]],
    );
    assert.equal(d.bySource.find((row) => row.source === 'ADMIN')?.count, 2);
    assert.equal(d.byClass[0]?.label, 'No class (special courses)');
  });

  it('ranks popular courses by new enrolments, then active enrolments', async () => {
    const students = await Promise.all(Array.from({ length: 5 }, () => student()));
    const [x, y, z] = [
      await course('X course'),
      await course('Y course'),
      await course('Z course'),
    ];
    const inRange = new Date('2026-05-10T06:00:00Z');
    const before = new Date('2026-01-10T06:00:00Z');
    // X: 1 new; Y: 1 new + 1 older active; Z: 2 new (one cancelled, one completed).
    await enrol(students[0]!.id, x.id, inRange);
    await enrol(students[1]!.id, y.id, inRange);
    await enrol(students[2]!.id, y.id, before);
    await enrol(students[3]!.id, z.id, inRange, { status: 'CANCELLED' });
    await enrol(students[4]!.id, z.id, inRange, { completedAt: inRange });

    const res = await admin<PaginatedAnalytics<PopularCourseRow>>(
      'GET',
      '/admin/analytics/popular-courses?from=2026-05-01&to=2026-05-31',
    );
    expectStatus(res, 200);
    assert.deepEqual(
      res.body.data.items.map((row) => [
        row.rank,
        row.course.title,
        row.newEnrollments,
        row.activeEnrollments,
      ]),
      [
        [1, 'Z course', 2, 1],
        [2, 'Y course', 1, 2],
        [3, 'X course', 1, 1],
      ],
    );
    const zRow = res.body.data.items[0]!;
    assert.equal(zRow.totalEnrollments, 2);
    assert.equal(zRow.completedEnrollments, 1);
    assert.equal(zRow.completionPercent, 100);
  });
});

// --- Revenue --------------------------------------------------------------------------------

describe('GET /admin/analytics/revenue', () => {
  it('counts captured payments once, subtracts processed refunds and ignores failures', async () => {
    const s = await student();
    const c = await course('Paid course');
    const at = new Date('2026-05-10T06:00:00Z');
    const live = await order(s.id, c.id, 'LIVE', 50_000);
    const captured = await payment(live, 'CAPTURED', 50_000, at, 'pay_live_once');
    await payment(await order(s.id, c.id, 'LIVE', 20_000, 'PENDING'), 'FAILED', 20_000, at);
    // Test-mode money is never live revenue.
    await payment(await order(s.id, c.id, 'TEST', 99_900), 'CAPTURED', 99_900, at);
    // A captured payment just outside the range (31 May 23:59 IST is in; 1 Jun 00:00 IST is out).
    await payment(
      await order(s.id, c.id, 'LIVE', 10_000),
      'CAPTURED',
      10_000,
      new Date('2026-05-31T18:30:00Z'),
    );
    // A duplicate provider event cannot create a second row for the same provider payment.
    await assert.rejects(payment(live, 'CAPTURED', 50_000, at, 'pay_live_once'));
    await prisma.refund.createMany({
      data: [
        {
          paymentId: captured.id,
          mode: 'LIVE',
          amountMinor: 10_000,
          currency: 'INR',
          status: 'PROCESSED',
          processedAt: new Date('2026-05-12T06:00:00Z'),
        },
        {
          paymentId: captured.id,
          mode: 'LIVE',
          amountMinor: 5_000,
          currency: 'INR',
          status: 'PENDING',
        },
      ],
    });

    const res = await admin<RevenueAnalyticsDto>(
      'GET',
      '/admin/analytics/revenue?from=2026-05-01&to=2026-05-31',
    );
    expectStatus(res, 200);
    const d = res.body.data;
    assert.equal(d.mode, 'LIVE');
    assert.deepEqual(d.totals, [
      {
        currency: 'INR',
        grossCapturedMinor: 50_000,
        refundedMinor: 10_000,
        netMinor: 40_000,
        capturedPaymentCount: 1,
      },
    ]);
    assert.equal(d.failedPayments, 1);
    assert.deepEqual(
      d.byCourse.map((row) => [row.course.title, row.grossMinor, row.refundedMinor, row.netMinor]),
      [['Paid course', 50_000, 10_000, 40_000]],
    );
    const points = d.series[0]!.points;
    assert.equal(points.find((p) => p.period === '2026-05-10')?.grossMinor, 50_000);
    assert.equal(points.find((p) => p.period === '2026-05-12')?.refundedMinor, 10_000);
    assert.equal(
      points.reduce((sum, p) => sum + p.netMinor, 0),
      40_000,
    );

    const test = await admin<RevenueAnalyticsDto>(
      'GET',
      '/admin/analytics/revenue?from=2026-05-01&to=2026-05-31&mode=TEST',
    );
    assert.equal(test.body.data.totals[0]?.grossCapturedMinor, 99_900);
  });
});

// --- Completion -----------------------------------------------------------------------------

describe('GET /admin/analytics/completion', () => {
  it('divides completed by ACTIVE enrolments only', async () => {
    const c = await course('Completion course');
    const done = new Date('2026-05-10T06:00:00Z');
    const [a, b, d, e] = await Promise.all([student(), student(), student(), student()]);
    await enrol(a.id, c.id, done, { completedAt: done });
    await enrol(b.id, c.id, done);
    await enrol(d.id, c.id, done);
    // Cancelled — even though completed — is outside both numerator and denominator.
    await enrol(e.id, c.id, done, { status: 'CANCELLED', completedAt: done });

    const res = await admin<CompletionAnalyticsDto>('GET', '/admin/analytics/completion');
    expectStatus(res, 200);
    assert.equal(res.body.data.range, null);
    assert.deepEqual(res.body.data.overall, { eligible: 3, completed: 1, completionPercent: 33 });
    assert.equal(res.body.data.items[0]?.completionPercent, 33);
  });
});

// --- Exams ----------------------------------------------------------------------------------

describe('GET /admin/analytics/exams', () => {
  it('reports pending grading separately and never scores it as zero', async () => {
    const c = await course('Exam course');
    const opensAt = new Date('2026-05-01T04:30:00Z');
    const exam = await prisma.examination.create({
      data: {
        courseId: c.id,
        title: 'Mid-term',
        status: 'PUBLISHED',
        publishedAt: opensAt,
        opensAt,
        closesAt: new Date('2026-05-20T04:30:00Z'),
        durationMinutes: 60,
        maxAttempts: 2,
      },
    });
    await prisma.examination.create({
      data: {
        courseId: c.id,
        title: 'Draft exam',
        opensAt,
        closesAt: new Date('2026-05-20T04:30:00Z'),
        durationMinutes: 60,
      },
    });
    const at = new Date('2026-05-10T06:00:00Z');
    const base = { examinationId: exam.id, startedAt: at, maxScore: 50 };
    const [a, b, d, e] = await Promise.all([student(), student(), student(), student()]);
    const evaluated = (userId: string, score: number) =>
      prisma.assessmentAttempt.create({
        data: {
          ...base,
          userId,
          attemptNumber: 1,
          status: 'SUBMITTED',
          submittedAt: at,
          finalizedAt: at,
          evaluationStatus: 'EVALUATED',
          rawScore: score,
          penalty: 0,
          score,
          percent: (score / 50) * 100,
          passed: score >= 20,
          evaluatedAt: at,
        },
      });
    await evaluated(a.id, 40); // 80 %, passed
    await evaluated(b.id, 10); // 20 %, failed
    await prisma.assessmentAttempt.create({
      data: {
        ...base,
        userId: d.id,
        attemptNumber: 1,
        status: 'SUBMITTED',
        submittedAt: at,
        finalizedAt: at,
        evaluationStatus: 'PENDING',
      },
    });
    await prisma.assessmentAttempt.create({
      data: { ...base, userId: e.id, attemptNumber: 1, status: 'IN_PROGRESS' },
    });

    const res = await admin<ExamAnalyticsDto>('GET', '/admin/analytics/exams');
    expectStatus(res, 200);
    const d1 = res.body.data;
    assert.deepEqual(d1.overall, {
      finalizedAttempts: 3,
      evaluatedAttempts: 2,
      pendingEvaluation: 1,
      averagePercent: 50,
      passedAttempts: 1,
      passPercent: 50,
      distinctStudents: 3,
    });
    assert.equal(d1.items.length, 1, 'draft examinations are excluded');
    assert.equal(d1.distribution.find((bucket) => bucket.from === 80)?.count, 1);
    assert.equal(d1.distribution.find((bucket) => bucket.from === 20)?.count, 1);
    assert.equal(d1.distribution.find((bucket) => bucket.from === 0)?.count, 0);
  });
});

// --- Faculty --------------------------------------------------------------------------------

describe('GET /admin/analytics/faculty', () => {
  it('scopes students and backlog to the faculty member’s course assignments', async () => {
    const assigned = await createFaculty('Asha Assigned');
    await createFaculty('Omar Other');
    const c = await course('Taught course');
    await prisma.courseInstructor.create({
      data: { courseId: c.id, facultyProfileId: assigned.facultyProfileId, isPrimary: true },
    });
    const [a, b] = await Promise.all([student(), student()]);
    await enrol(a.id, c.id, new Date(), { completedAt: new Date() });
    await enrol(b.id, c.id, new Date());
    const startsAt = new Date(Date.now() - 2 * 86_400_000);
    await prisma.liveClassSession.create({
      data: {
        courseId: c.id,
        hostFacultyProfileId: assigned.facultyProfileId,
        title: 'Held class',
        startsAt,
        durationMinutes: 60,
        status: 'COMPLETED',
        completedAt: startsAt,
      },
    });

    const res = await admin<PaginatedAnalytics<FacultyPerformanceRow>>(
      'GET',
      '/admin/analytics/faculty',
    );
    expectStatus(res, 200);
    const byName = new Map(res.body.data.items.map((row) => [row.faculty.fullName, row]));
    const asha = byName.get('Asha Assigned')!;
    assert.equal(asha.assignedCourses, 1);
    assert.equal(asha.activeStudents, 2);
    assert.equal(asha.liveClassesCompleted, 1);
    assert.equal(asha.completionPercent, 50);
    const omar = byName.get('Omar Other')!;
    assert.equal(omar.assignedCourses, 0);
    assert.equal(omar.activeStudents, 0);
    assert.equal(omar.completionPercent, null);
  });
});

// --- Users, roles and audit -----------------------------------------------------------------

describe('user administration', () => {
  it('lists and shows students to ADMIN, but hides admin accounts', async () => {
    const s = await student();
    const list = await admin<Paginated<AdminUserListItem>>(
      'GET',
      `/admin/users?role=STUDENT&q=${encodeURIComponent(s.email)}`,
    );
    expectStatus(list, 200);
    assert.equal(list.body.data.items[0]?.id, s.id);
    const detail = await admin<AdminUserDetail>('GET', `/admin/users/${s.id}`);
    expectStatus(detail, 200);
    assert.deepEqual(detail.body.data.orders, [], 'ADMIN holds payments.view');
    assert.equal(detail.body.data.capabilities.manageRoles, false);

    const otherAdmin = await provision('ADMIN');
    expectStatus(await admin('GET', `/admin/users/${otherAdmin.id}`), 404);
    expectStatus(
      await admin('PATCH', `/admin/users/${otherAdmin.id}/status`, { status: 'SUSPENDED' }),
      404,
    );
  });

  it('suspends an account, ends its access at once and audits the change', async () => {
    const email = uniqueEmail('target');
    const target = await provision('STUDENT', email);
    const token = (await login(client, email)).accessToken;
    expectStatus(await client.request('GET', '/student/dashboard', { token }), 200);

    const res = await admin<AdminUserDetail>('PATCH', `/admin/users/${target.id}/status`, {
      status: 'SUSPENDED',
      reason: 'Fee dispute',
    });
    expectStatus(res, 200);
    assert.equal(res.body.data.status, 'SUSPENDED');
    expectStatus(await client.request('GET', '/student/dashboard', { token }), 401);
    expectStatus(
      await client.request('POST', '/auth/login', { body: { email, password: PASSWORD } }),
      403,
    );

    const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { entityId: target.id } });
    assert.equal(audit.action, 'user.status_changed');
    assert.deepEqual(audit.data, { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Fee dispute' });
    assert.ok(audit.actorId);
  });

  it('refuses self-service changes and protects the last active Super Admin', async () => {
    const me = await prisma.user.findFirstOrThrow({
      where: { roles: { some: { role: { key: 'SUPER_ADMIN' } } } },
    });
    expectStatus(
      await superAdmin('PATCH', `/admin/users/${me.id}/status`, { status: 'INACTIVE' }),
      403,
    );
    expectStatus(await superAdmin('POST', `/admin/users/${me.id}/roles`, { role: 'FACULTY' }), 403);

    // Someone with every permission but not the SUPER_ADMIN role still cannot remove the last one.
    const all = (await prisma.permission.findMany()).map((p) => p.key);
    const ops = await customRoleUser(all);
    const res = await ops.api('PATCH', `/admin/users/${me.id}/status`, { status: 'SUSPENDED' });
    expectStatus(res, 409);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).status, 'ACTIVE');
  });

  it('prevents privilege escalation through role grants', async () => {
    const s = await student();
    // Holds roles.manage + students.manage only: may not hand out roles stronger than itself.
    const desk = await customRoleUser(['roles.manage', 'students.manage']);
    expectStatus(
      await desk.api('POST', `/admin/users/${s.id}/roles`, { role: 'SUPER_ADMIN' }),
      403,
    );
    expectStatus(await desk.api('POST', `/admin/users/${s.id}/roles`, { role: 'ADMIN' }), 403);
    // ADMIN lacks roles.manage entirely.
    expectStatus(await admin('POST', `/admin/users/${s.id}/roles`, { role: 'FACULTY' }), 403);
    assert.equal(await prisma.userRole.count({ where: { userId: s.id } }), 1);
  });

  it('lets the Super Admin grant and revoke roles, with profiles and audit', async () => {
    const s = await student();
    const granted = await superAdmin<AdminUserDetail>('POST', `/admin/users/${s.id}/roles`, {
      role: 'FACULTY',
    });
    expectStatus(granted, 201);
    assert.deepEqual(granted.body.data.roles, ['FACULTY', 'STUDENT']);
    assert.ok(granted.body.data.facultyProfile, 'a faculty profile is created');
    expectStatus(await superAdmin('POST', `/admin/users/${s.id}/roles`, { role: 'FACULTY' }), 409);

    // Faculty with course assignments keep the role until they are unassigned.
    const c = await course();
    await prisma.courseInstructor.create({
      data: {
        courseId: c.id,
        facultyProfileId: granted.body.data.facultyProfile!.facultyProfileId,
      },
    });
    expectStatus(await superAdmin('DELETE', `/admin/users/${s.id}/roles/FACULTY`), 409);
    await prisma.courseInstructor.deleteMany({ where: { courseId: c.id } });
    const revoked = await superAdmin<AdminUserDetail>(
      'DELETE',
      `/admin/users/${s.id}/roles/FACULTY`,
    );
    expectStatus(revoked, 200);
    assert.deepEqual(revoked.body.data.roles, ['STUDENT']);
    // The last role cannot be removed.
    expectStatus(await superAdmin('DELETE', `/admin/users/${s.id}/roles/STUDENT`), 409);

    const actions = (
      await prisma.adminAuditLog.findMany({
        where: { entityId: s.id },
        orderBy: { createdAt: 'asc' },
      })
    ).map((row) => row.action);
    assert.deepEqual(actions, ['user.role_granted', 'user.role_revoked']);
  });

  it('returns the role matrix to the Super Admin', async () => {
    const res = await superAdmin<AdminRolesDto>('GET', '/admin/roles');
    expectStatus(res, 200);
    const adminRole = res.body.data.roles.find((role) => role.key === 'ADMIN')!;
    assert.ok(adminRole.permissions.includes('analytics.view'));
    assert.ok(!adminRole.permissions.includes('audit_logs.view'));
    assert.ok(res.body.data.permissions.some((p) => p.key === 'audit_logs.view'));
  });
});

describe('audit logs of existing workflows', () => {
  it('records course publication, faculty assignment and admin enrolment with the actor', async () => {
    const { courseId } = await createPublishableCourse(superAdmin);
    const current = await superAdmin<{ updatedAt: string }>('GET', `/admin/courses/${courseId}`);
    expectStatus(
      await superAdmin('POST', `/admin/courses/${courseId}/publish`, {
        expectedUpdatedAt: current.body.data.updatedAt,
      }),
      200,
    );
    const s = await student();
    const enrolled = await superAdmin<{ id: string }>(
      'POST',
      `/admin/courses/${courseId}/enrollments`,
      {
        email: s.email,
      },
    );
    expectStatus(enrolled, 201);
    expectStatus(
      await superAdmin('POST', `/admin/enrollments/${enrolled.body.data.id}/cancel`),
      200,
    );

    const res = await superAdmin<Paginated<AdminAuditEntryDto>>(
      'GET',
      '/admin/audit-logs?source=admin',
    );
    expectStatus(res, 200);
    const actions = res.body.data.items.map((entry) => entry.action);
    for (const action of [
      'course.instructors_changed',
      'course.published',
      'enrollment.created_by_admin',
      'enrollment.cancelled_by_admin',
    ]) {
      assert.ok(actions.includes(action), `${action} recorded`);
    }
    assert.ok(res.body.data.items.every((entry) => entry.actor !== null));
    const prefix = await superAdmin<Paginated<AdminAuditEntryDto>>(
      'GET',
      '/admin/audit-logs?action=course.',
    );
    assert.ok(prefix.body.data.items.every((entry) => entry.action.startsWith('course.')));
  });

  it('exposes no endpoint that modifies audit entries', async () => {
    const entryId = randomUUID();
    expectStatus(await superAdmin('DELETE', `/admin/audit-logs/${entryId}`), 404);
    expectStatus(await superAdmin('PATCH', `/admin/audit-logs/${entryId}`, {}), 404);
  });
});
