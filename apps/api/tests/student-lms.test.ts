/**
 * PHASE 07 — Student LMS through `/api/v1/student/*` and the admin enrolment endpoints
 * (real middleware, real database): authentication/authorization, enrolment and course access,
 * curriculum and lesson navigation, persistent progress, video telemetry, profile and records.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  AdminEnrollmentDto,
  LearningHistoryItem,
  LessonProgressUpdateDto,
  Paginated,
  StudentCatalogCourse,
  StudentCourseCard,
  StudentCourseOverview,
  StudentCurriculumDto,
  StudentDashboardDto,
  StudentEnrollmentRecord,
  StudentLessonDto,
  StudentLessonListItem,
  StudentProfileDto,
  StudentResourceDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { login, provision, registerVerifiedStudent, resetAuthState } from './support/auth.js';
import {
  apiAs,
  createPublishableCourse,
  expectStatus,
  tokenFor,
  type Api,
} from './support/catalog.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
let admin: Api;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(async () => {
  await resetAuthState();
  const client = new TestClient(baseUrl);
  admin = apiAs(client, await tokenFor(client, 'ADMIN'));
});

/** A signed-in student with their own cookie jar, plus the user id. */
async function newStudent() {
  const client = new TestClient(baseUrl);
  const email = await registerVerifiedStudent(client);
  const session = await login(client, email);
  return { api: apiAs(client, session.accessToken), userId: session.user.id, email };
}

async function create<T = { id: string }>(path: string, body: unknown): Promise<T> {
  const response = await admin<T>('POST', path, body);
  expectStatus(response, 201);
  return response.body.data;
}

/**
 * Published course with, in CMS order:
 *   Algebra › Quadratic equations: L1 VIDEO (100 s, video link), L2 PDF (PDF link), draft TEXT
 *   Geometry › Triangles:          L4 QUIZ (instructions),       L5 TEXT
 * Eligible for progress: L1, L2, L5.
 */
async function buildCourse(pricing: { priceMinor: number | null } = { priceMinor: 0 }) {
  const ids = await createPublishableCourse(admin, {
    ...(pricing.priceMinor === null ? {} : { priceMinor: pricing.priceMinor, currency: 'INR' }),
  });
  expectStatus(
    await admin('PATCH', `/admin/lessons/${ids.lessonId}`, { durationSeconds: 100 }),
    200,
  );
  const pdf = await create(`/admin/chapters/${ids.chapterId}/lessons`, {
    title: 'Worked examples (PDF)',
    contentType: 'PDF',
    status: 'PUBLISHED',
  });
  const pdfResource = await create(`/admin/lessons/${pdf.id}/resources`, {
    title: 'Notes',
    type: 'PDF',
    location: { kind: 'external', externalUrl: 'https://files.example.com/quadratics.pdf' },
  });
  const draft = await create(`/admin/chapters/${ids.chapterId}/lessons`, {
    title: 'Unreleased draft',
    contentType: 'TEXT',
    body: 'Secret draft text',
  });
  const geometry = await create(`/admin/courses/${ids.courseId}/modules`, { title: 'Geometry' });
  const triangles = await create(`/admin/modules/${geometry.id}/chapters`, { title: 'Triangles' });
  const quiz = await create(`/admin/chapters/${triangles.id}/lessons`, {
    title: 'Triangles quiz',
    contentType: 'QUIZ',
    body: 'Answer the questions shared by your teacher.',
    status: 'PUBLISHED',
  });
  const text = await create(`/admin/chapters/${triangles.id}/lessons`, {
    title: 'Similar triangles',
    contentType: 'TEXT',
    body: 'Two triangles are similar when…',
    status: 'PUBLISHED',
  });
  expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);
  return {
    ...ids,
    video: ids.lessonId,
    pdf: pdf.id,
    pdfResource: pdfResource.id,
    draft: draft.id,
    quiz: quiz.id,
    text: text.id,
  };
}

async function enrollFree(api: Api, courseId: string) {
  const response = await api<StudentCourseOverview>('POST', `/student/courses/${courseId}/enroll`);
  expectStatus(response, 201);
  return response.body.data;
}

// --- Authentication & authorization ----------------------------------------------------------

describe('student portal authorization', () => {
  it('rejects unauthenticated requests on every student endpoint', async () => {
    const visitor = apiAs(new TestClient(baseUrl), undefined);
    for (const path of [
      '/student/dashboard',
      '/student/courses',
      '/student/profile',
      '/student/history',
      `/student/lessons/${crypto.randomUUID()}`,
    ]) {
      assert.equal((await visitor('GET', path)).status, 401, path);
    }
    assert.equal(
      (await visitor('POST', `/student/lessons/${crypto.randomUUID()}/complete`)).status,
      401,
    );
  });

  it('keeps staff out of the student portal and students out of administration', async () => {
    const staffClient = new TestClient(baseUrl);
    const faculty = apiAs(staffClient, await tokenFor(staffClient, 'FACULTY'));
    assert.equal((await admin('GET', '/student/dashboard')).status, 403);
    assert.equal((await faculty('GET', '/student/courses')).status, 403);

    const { api: student } = await newStudent();
    const course = await buildCourse();
    assert.equal((await student('GET', '/admin/courses')).status, 403);
    assert.equal(
      (await student('GET', `/admin/courses/${course.courseId}/enrollments`)).status,
      403,
    );
    assert.equal(
      (await student('POST', `/admin/courses/${course.courseId}/enrollments`, { email: 'x@y.z' }))
        .status,
      403,
    );
    // Faculty do not hold enrollments.manage.
    assert.equal(
      (await faculty('GET', `/admin/courses/${course.courseId}/enrollments`)).status,
      403,
    );
  });

  it('validates path parameters', async () => {
    const { api: student } = await newStudent();
    assert.equal((await student('GET', '/student/lessons/not-a-uuid')).status, 422);
    assert.equal((await student('GET', '/student/courses/not-a-uuid/curriculum')).status, 422);
  });
});

// --- Enrolment & access ---------------------------------------------------------------------

describe('enrolment and course access', () => {
  it('lets a student enrol in a free course once, without duplicates', async () => {
    const course = await buildCourse({ priceMinor: 0 });
    const { api: student, userId } = await newStudent();

    const before = await student<StudentCourseOverview>(
      'GET',
      `/student/courses/${course.courseId}`,
    );
    expectStatus(before, 200);
    assert.equal(before.body.data.access, 'FREE_ENROLMENT');
    assert.equal(before.body.data.curriculum, null, 'no lesson ids before enrolment');
    assert.equal(before.body.data.lessonCount, 4, 'outline counts published lessons only');

    const enrolled = await enrollFree(student, course.courseId);
    assert.equal(enrolled.access, 'ENROLLED');
    assert.equal(enrolled.enrollment?.source, 'FREE');

    const again = await student('POST', `/student/courses/${course.courseId}/enroll`);
    expectStatus(again, 200);
    assert.equal(await prisma.enrollment.count({ where: { userId } }), 1);

    const courses = await student<Paginated<StudentCourseCard>>('GET', '/student/courses');
    assert.deepEqual(
      courses.body.data.items.map((item) => item.id),
      [course.courseId],
    );
  });

  it('never grants paid or unpriced courses through self-enrolment', async () => {
    const paid = await buildCourse({ priceMinor: 250_000 });
    const unpriced = await buildCourse({ priceMinor: null });
    const { api: student, userId } = await newStudent();

    for (const courseId of [paid.courseId, unpriced.courseId]) {
      const overview = await student<StudentCourseOverview>('GET', `/student/courses/${courseId}`);
      assert.equal(overview.body.data.access, 'CONTACT_ACADEMY');
      assert.equal((await student('POST', `/student/courses/${courseId}/enroll`)).status, 403);
    }
    // A body claiming payment is not even read.
    const forged = await student('POST', `/student/courses/${paid.courseId}/enroll`, {
      paymentStatus: 'SUCCESS',
      priceMinor: 0,
    });
    assert.equal(forged.status, 403);
    assert.equal(await prisma.enrollment.count({ where: { userId } }), 0);
    assert.equal(
      (await student('GET', `/student/courses/${paid.courseId}/curriculum`)).status,
      403,
    );
  });

  it('hides unpublished and private courses and blocks content without enrolment', async () => {
    const course = await buildCourse();
    const { api: student } = await newStudent();

    // Not enrolled: content endpoints are forbidden.
    for (const path of [
      `/student/courses/${course.courseId}/curriculum`,
      `/student/courses/${course.courseId}/progress`,
      `/student/lessons/${course.video}`,
      `/student/lessons/${course.video}/resources`,
    ]) {
      assert.equal((await student('GET', path)).status, 403, path);
    }
    assert.equal((await student('POST', `/student/lessons/${course.video}/complete`)).status, 403);
    assert.equal(
      (
        await student('PUT', `/student/lessons/${course.video}/progress`, {
          positionSeconds: 1,
          playedSeconds: 1,
        })
      ).status,
      403,
    );

    // PRIVATE: invisible without enrolment.
    expectStatus(
      await admin('PATCH', `/admin/courses/${course.courseId}`, { visibility: 'PRIVATE' }),
      200,
    );
    assert.equal((await student('GET', `/student/courses/${course.courseId}`)).status, 404);
    assert.equal((await student('POST', `/student/courses/${course.courseId}/enroll`)).status, 404);

    // Unpublished: 404 even for enrolled students.
    const { api: enrolled } = await newStudent();
    expectStatus(
      await admin('PATCH', `/admin/courses/${course.courseId}`, { visibility: 'PUBLIC' }),
      200,
    );
    await enrollFree(enrolled, course.courseId);
    expectStatus(await enrolled('GET', `/student/lessons/${course.video}`), 200);
    expectStatus(await admin('POST', `/admin/courses/${course.courseId}/unpublish`), 200);
    assert.equal((await enrolled('GET', `/student/lessons/${course.video}`)).status, 404);
    assert.equal((await enrolled('GET', `/student/courses/${course.courseId}`)).status, 404);
    const list = await enrolled<Paginated<StudentCourseCard>>('GET', '/student/courses');
    assert.equal(list.body.data.items.length, 0);
  });

  it('administrators enrol by email (paid course) and cancellation revokes access', async () => {
    const course = await buildCourse({ priceMinor: 250_000 });
    const { api: student, email } = await newStudent();

    const enrol = await admin<AdminEnrollmentDto>(
      'POST',
      `/admin/courses/${course.courseId}/enrollments`,
      { email },
    );
    expectStatus(enrol, 201);
    assert.equal(enrol.body.data.source, 'ADMIN');
    assert.equal(enrol.body.data.enrolledBy, 'Test ADMIN');
    expectStatus(await student('GET', `/student/lessons/${course.video}`), 200);

    const duplicate = await admin('POST', `/admin/courses/${course.courseId}/enrollments`, {
      email,
    });
    assert.equal(duplicate.status, 409);

    const staff = await provision('FACULTY');
    const notStudent = await admin('POST', `/admin/courses/${course.courseId}/enrollments`, {
      email: staff.email,
    });
    assert.equal(notStudent.status, 422);
    const overPost = await admin('POST', `/admin/courses/${course.courseId}/enrollments`, {
      email,
      status: 'ACTIVE',
    });
    assert.equal(overPost.status, 422);

    const list = await admin<Paginated<AdminEnrollmentDto>>(
      'GET',
      `/admin/courses/${course.courseId}/enrollments`,
    );
    assert.equal(list.body.data.pagination.total, 1);

    expectStatus(await admin('POST', `/admin/enrollments/${enrol.body.data.id}/cancel`), 200);
    assert.equal(
      (await admin('POST', `/admin/enrollments/${enrol.body.data.id}/cancel`)).status,
      409,
    );
    assert.equal((await student('GET', `/student/lessons/${course.video}`)).status, 403);
    // The student cannot reopen an enrolment the academy cancelled.
    expectStatus(
      await admin('PATCH', `/admin/courses/${course.courseId}`, { priceMinor: 0, currency: 'INR' }),
      200,
    );
    assert.equal((await student('POST', `/student/courses/${course.courseId}/enroll`)).status, 409);

    // Re-enrolment by an administrator reactivates the same row.
    expectStatus(
      await admin('POST', `/admin/courses/${course.courseId}/enrollments`, { email }),
      201,
    );
    assert.equal(await prisma.enrollment.count({ where: { courseId: course.courseId } }), 1);
    expectStatus(await student('GET', `/student/lessons/${course.video}`), 200);
  });

  it('refuses to delete a course with enrolment history', async () => {
    // A draft without curriculum would normally be deletable; its enrolment keeps it.
    const { userId } = await newStudent();
    const course = await prisma.course.create({
      data: {
        title: 'Pre-enrolled draft',
        slug: `pre-enrolled-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    await prisma.enrollment.create({
      data: { userId, courseId: course.id, source: 'FREE', status: 'ACTIVE' },
    });
    const response = await admin('DELETE', `/admin/courses/${course.id}`);
    assert.equal(response.status, 409);
    assert.match(response.body.message, /enrolled/);
  });
});

// --- Curriculum & lessons -------------------------------------------------------------------

describe('curriculum and lesson player', () => {
  it('returns the published curriculum in CMS order without drafts', async () => {
    const course = await buildCourse();
    const { api: student } = await newStudent();
    await enrollFree(student, course.courseId);

    const tree = await student<StudentCurriculumDto>(
      'GET',
      `/student/courses/${course.courseId}/curriculum`,
    );
    expectStatus(tree, 200);
    const lessons = tree.body.data.modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons));
    assert.deepEqual(
      lessons.map((l) => l.id),
      [course.video, course.pdf, course.quiz, course.text],
    );
    assert.ok(!tree.text.includes('Secret draft text'));
    assert.ok(!tree.text.includes('Unreleased draft'));
    assert.equal(lessons.find((l) => l.id === course.quiz)?.countsTowardProgress, false);
    assert.deepEqual(tree.body.data.progress, {
      completedLessons: 0,
      totalLessons: 3,
      percent: 0,
      completedAt: null,
    });
    assert.equal(tree.body.data.resumeLessonId, course.video);

    assert.equal((await student('GET', `/student/lessons/${course.draft}`)).status, 404);
    assert.equal((await student('GET', `/student/lessons/${crypto.randomUUID()}`)).status, 404);
  });

  it('serves lessons with safe resources and course-bounded navigation', async () => {
    const course = await buildCourse();
    const other = await buildCourse();
    const { api: student } = await newStudent();
    await enrollFree(student, course.courseId);

    const first = await student<StudentLessonDto>('GET', `/student/lessons/${course.video}`);
    expectStatus(first, 200);
    assert.equal(first.body.data.navigation.previous, null, 'no previous before the first lesson');
    assert.equal(first.body.data.navigation.next?.id, course.pdf, 'skips nothing, keeps order');
    assert.equal(first.body.data.navigation.total, 4);
    assert.deepEqual(first.body.data.resources[0]?.access, {
      kind: 'external',
      url: 'https://videos.example.com/quadratics-1',
    });

    const pdf = await student<StudentLessonDto>('GET', `/student/lessons/${course.pdf}`);
    assert.equal(pdf.body.data.navigation.next?.id, course.quiz, 'the draft lesson is skipped');
    const last = await student<StudentLessonDto>('GET', `/student/lessons/${course.text}`);
    assert.equal(last.body.data.navigation.next, null, 'no next beyond the course');
    assert.equal(last.body.data.navigation.position, 4);

    // A lesson of a course the student is not enrolled in is not reachable by changing the id.
    assert.equal((await student('GET', `/student/lessons/${other.video}`)).status, 403);
    assert.equal((await student('GET', `/student/lessons/${other.pdf}/resources`)).status, 403);

    // Stored objects are reported as unavailable (no storage provider), never as a raw key.
    await prisma.resource.create({
      data: {
        lessonId: course.pdf,
        title: 'Stored notes',
        type: 'PDF',
        storageProvider: 's3',
        storageKey: 'private/notes.pdf',
        position: 5,
      },
    });
    const resources = await student<StudentResourceDto[]>(
      'GET',
      `/student/lessons/${course.pdf}/resources`,
    );
    expectStatus(resources, 200);
    assert.equal(resources.body.data[1]?.access.kind, 'unavailable');
    assert.ok(!resources.text.includes('private/notes.pdf'));
  });

  it('lists quiz and assignment lessons of enrolled courses only', async () => {
    const course = await buildCourse();
    await buildCourse(); // not enrolled
    const { api: student } = await newStudent();
    await enrollFree(student, course.courseId);
    const quizzes = await student<Paginated<StudentLessonListItem>>(
      'GET',
      '/student/lessons?contentType=QUIZ',
    );
    expectStatus(quizzes, 200);
    assert.deepEqual(
      quizzes.body.data.items.map((item) => item.lesson.lessonId),
      [course.quiz],
    );
    assert.equal((await student('GET', '/student/lessons?contentType=EXAM')).status, 422);
  });
});

// --- Progress -------------------------------------------------------------------------------

describe('learning progress', () => {
  it('persists completion idempotently and derives course progress', async () => {
    const course = await buildCourse();
    const { api: student, userId } = await newStudent();
    await enrollFree(student, course.courseId);

    const done = await student<LessonProgressUpdateDto>(
      'POST',
      `/student/lessons/${course.video}/complete`,
    );
    expectStatus(done, 200);
    assert.ok(done.body.data.progress.completedAt);
    assert.deepEqual(done.body.data.course, {
      completedLessons: 1,
      totalLessons: 3,
      percent: 33,
      completedAt: null,
    });
    const firstCompletion = done.body.data.progress.completedAt;

    const again = await student<LessonProgressUpdateDto>(
      'POST',
      `/student/lessons/${course.video}/complete`,
    );
    assert.equal(again.body.data.progress.completedAt, firstCompletion, 'first time is kept');
    assert.equal(
      await prisma.lessonProgress.count({ where: { userId, lessonId: course.video } }),
      1,
    );

    // Quiz placeholders cannot be completed and do not count.
    assert.equal((await student('POST', `/student/lessons/${course.quiz}/complete`)).status, 409);

    await student('POST', `/student/lessons/${course.pdf}/complete`);
    const final = await student<LessonProgressUpdateDto>(
      'POST',
      `/student/lessons/${course.text}/complete`,
    );
    assert.equal(final.body.data.course.percent, 100);
    assert.ok(final.body.data.course.completedAt, 'course completion recorded');
    const enrollment = await prisma.enrollment.findFirstOrThrow({ where: { userId } });
    assert.ok(enrollment.completedAt);

    // Reopening a lesson lowers progress but keeps the first course completion date.
    const reopened = await student<LessonProgressUpdateDto>(
      'DELETE',
      `/student/lessons/${course.text}/complete`,
    );
    assert.equal(reopened.body.data.progress.completedAt, null);
    assert.equal(reopened.body.data.course.percent, 66);
    assert.ok(reopened.body.data.course.completedAt);

    const progress = await student('GET', `/student/courses/${course.courseId}/progress`);
    assert.equal((progress.body.data as { completedLessons: number }).completedLessons, 2);
  });

  it('records activity and resumes at the last valid lesson', async () => {
    const course = await buildCourse();
    const { api: student, userId } = await newStudent();
    await enrollFree(student, course.courseId);

    // Reading a lesson has no side effect.
    await student('GET', `/student/lessons/${course.pdf}`);
    assert.equal(await prisma.lessonProgress.count({ where: { userId } }), 0);

    expectStatus(await student('POST', `/student/lessons/${course.pdf}/activity`), 200);
    const enrollment = await prisma.enrollment.findFirstOrThrow({ where: { userId } });
    assert.equal(enrollment.lastLessonId, course.pdf);
    assert.ok(enrollment.lastActivityAt);

    const overview = await student<StudentCourseOverview>(
      'GET',
      `/student/courses/${course.courseId}`,
    );
    assert.equal(overview.body.data.resumeLesson?.lessonId, course.pdf);

    const dashboard = await student<StudentDashboardDto>('GET', '/student/dashboard');
    expectStatus(dashboard, 200);
    assert.equal(dashboard.body.data.continueLearning[0]?.lesson.lessonId, course.pdf);
    assert.equal(dashboard.body.data.stats.activeCourses, 1);
    assert.equal(dashboard.body.data.assessments.quizzes, 1);
    assert.equal(dashboard.body.data.features.payments.available, false);
    assert.equal(dashboard.body.data.features.certificates.available, false);

    // When the resume lesson is unpublished, resume falls back to the first accessible lesson.
    expectStatus(await admin('PATCH', `/admin/lessons/${course.pdf}`, { status: 'DRAFT' }), 200);
    const fallback = await student<StudentCourseOverview>(
      'GET',
      `/student/courses/${course.courseId}`,
    );
    assert.equal(fallback.body.data.resumeLesson?.lessonId, course.video);

    const history = await student<Paginated<LearningHistoryItem>>('GET', '/student/history');
    assert.equal(history.body.data.items.length, 0, 'unpublished lessons leave the history');
  });

  it('keeps every student’s progress private', async () => {
    const course = await buildCourse();
    const alice = await newStudent();
    const bob = await newStudent();
    await enrollFree(alice.api, course.courseId);

    await alice.api('POST', `/student/lessons/${course.video}/complete`);
    // Bob is not enrolled: he can neither read nor change Alice's course.
    assert.equal((await bob.api('POST', `/student/lessons/${course.video}/complete`)).status, 403);
    assert.equal(
      (await bob.api('GET', `/student/courses/${course.courseId}/progress`)).status,
      403,
    );

    // Once enrolled, Bob sees only his own (empty) progress.
    await enrollFree(bob.api, course.courseId);
    const bobTree = await bob.api<StudentCurriculumDto>(
      'GET',
      `/student/courses/${course.courseId}/curriculum`,
    );
    assert.equal(bobTree.body.data.progress.completedLessons, 0);
    const bobHistory = await bob.api<Paginated<LearningHistoryItem>>('GET', '/student/history');
    assert.equal(bobHistory.body.data.items.length, 0);
    const aliceHistory = await alice.api<Paginated<LearningHistoryItem>>('GET', '/student/history');
    assert.equal(aliceHistory.body.data.items.length, 1);
  });

  it('credits video playback from bounded heartbeats only', async () => {
    const course = await buildCourse();
    const { api: student, userId } = await newStudent();
    await enrollFree(student, course.courseId);
    const path = `/student/lessons/${course.video}/progress`;

    // Invalid inputs: over-long heartbeat, negative, unknown keys (no client percentages).
    assert.equal(
      (await student('PUT', path, { positionSeconds: 5, playedSeconds: 500 })).status,
      422,
    );
    assert.equal(
      (await student('PUT', path, { positionSeconds: -1, playedSeconds: 1 })).status,
      422,
    );
    assert.equal(
      (await student('PUT', path, { positionSeconds: 5, playedSeconds: 5, percent: 100 })).status,
      422,
    );
    // Only video lessons take playback progress.
    assert.equal(
      (
        await student('PUT', `/student/lessons/${course.pdf}/progress`, {
          positionSeconds: 5,
          playedSeconds: 5,
        })
      ).status,
      400,
    );

    const first = await student<LessonProgressUpdateDto>('PUT', path, {
      positionSeconds: 95,
      playedSeconds: 120,
    });
    expectStatus(first, 200);
    // First heartbeat: at most 30 s credited, whatever the client claims; position kept.
    assert.equal(first.body.data.progress.videoWatchedSeconds, 30);
    assert.equal(first.body.data.progress.videoPositionSeconds, 95);
    assert.equal(first.body.data.progress.videoCompletedAt, null);

    // An immediate second heartbeat is bounded by wall-clock time (~0 s + slack).
    const second = await student<LessonProgressUpdateDto>('PUT', path, {
      positionSeconds: 100,
      playedSeconds: 120,
    });
    assert.ok(second.body.data.progress.videoWatchedSeconds <= 33);
    assert.equal(second.body.data.progress.videoCompletedAt, null);
    // Video telemetry never completes the lesson by itself.
    assert.equal(second.body.data.progress.completedAt, null);

    // Simulate real time passing between heartbeats, then reach 90% of the 100 s duration.
    await prisma.lessonProgress.update({
      where: { userId_lessonId: { userId, lessonId: course.video } },
      data: { videoHeartbeatAt: new Date(Date.now() - 120_000) },
    });
    const third = await student<LessonProgressUpdateDto>('PUT', path, {
      positionSeconds: 400,
      playedSeconds: 120,
    });
    assert.equal(third.body.data.progress.videoWatchedSeconds, 100, 'capped at the duration');
    assert.equal(third.body.data.progress.videoPositionSeconds, 100, 'position capped too');
    assert.ok(third.body.data.progress.videoCompletedAt);
  });
});

// --- Profile & records ----------------------------------------------------------------------

describe('profile and records', () => {
  it('updates permitted profile fields only', async () => {
    const { api: student, userId, email } = await newStudent();
    const profile = await student<StudentProfileDto>('GET', '/student/profile');
    expectStatus(profile, 200);
    assert.equal(profile.body.data.email, email);
    assert.equal(profile.body.data.class, null, 'no invented academic details');

    const updated = await student<StudentProfileDto>('PATCH', '/student/profile', {
      fullName: '  Ayesha Khan ',
      phone: '+91 98765 43210',
    });
    expectStatus(updated, 200);
    assert.equal(updated.body.data.fullName, 'Ayesha Khan');
    assert.equal(updated.body.data.phone, '+91 98765 43210');

    for (const body of [
      { roles: ['ADMIN'] },
      { email: 'new@example.test' },
      { status: 'ACTIVE' },
      { fullName: 'Valid Name', emailVerifiedAt: null },
      { phone: 'call me' },
      { fullName: 'A' },
      {},
    ]) {
      assert.equal(
        (await student('PATCH', '/student/profile', body)).status,
        422,
        JSON.stringify(body),
      );
    }
    const roles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    assert.deepEqual(
      roles.map((r) => r.role.key),
      ['STUDENT'],
    );

    const cleared = await student<StudentProfileDto>('PATCH', '/student/profile', { phone: '' });
    assert.equal(cleared.body.data.phone, null);
  });

  it('scopes enrolment records and the catalogue to the signed-in student', async () => {
    const free = await buildCourse({ priceMinor: 0 });
    const paid = await buildCourse({ priceMinor: 99_900 });
    const alice = await newStudent();
    const bob = await newStudent();
    await enrollFree(alice.api, free.courseId);

    const catalog = await bob.api<Paginated<StudentCatalogCourse>>('GET', '/student/catalog');
    expectStatus(catalog, 200);
    const access = Object.fromEntries(catalog.body.data.items.map((c) => [c.id, c.access]));
    assert.equal(access[free.courseId], 'FREE_ENROLMENT');
    assert.equal(access[paid.courseId], 'CONTACT_ACADEMY');

    const aliceRecords = await alice.api<Paginated<StudentEnrollmentRecord>>(
      'GET',
      '/student/enrollments',
    );
    assert.equal(aliceRecords.body.data.items.length, 1);
    const bobRecords = await bob.api<Paginated<StudentEnrollmentRecord>>(
      'GET',
      '/student/enrollments',
    );
    assert.equal(bobRecords.body.data.items.length, 0);

    // Unavailable capabilities are reported honestly, never as empty fake data.
    const features = await bob.api<Record<string, { available: boolean }>>(
      'GET',
      '/student/features',
    );
    assert.ok(Object.values(features.body.data).every((feature) => feature.available === false));
  });
});
