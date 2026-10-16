/**
 * PHASE 08 — Faculty portal through `/api/v1/faculty/*` plus the student assignment, result and
 * live-class endpoints (real middleware, real database): course-scoped authorization, content
 * management through the shared curriculum service, assignments → submissions → grading →
 * result release, live-class scheduling, dashboard/students/performance and profile.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  CoursePerformanceDto,
  CurriculumTreeDto,
  FacultyAssignmentDetail,
  FacultyCourseCard,
  FacultyCourseDetail,
  FacultyDashboardDto,
  FacultyProfileDto,
  FacultyStudentRow,
  LiveClassDto,
  Paginated,
  StudentAssignmentDto,
  StudentResultItem,
  SubmissionDetailDto,
  SubmissionListItem,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { login, registerVerifiedStudent, resetAuthState } from './support/auth.js';
import {
  apiAs,
  createFaculty,
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

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function newFaculty() {
  const { user, facultyProfileId } = await createFaculty();
  const client = new TestClient(baseUrl);
  const session = await login(client, user.email);
  return { api: apiAs(client, session.accessToken), userId: user.id, facultyProfileId };
}

async function newStudent() {
  const client = new TestClient(baseUrl);
  const email = await registerVerifiedStudent(client);
  const session = await login(client, email);
  return { api: apiAs(client, session.accessToken), userId: session.user.id };
}

/** Replaces the course's instructors through the existing ADMIN process (first = primary). */
async function assign(courseId: string, ...facultyProfileIds: string[]) {
  expectStatus(
    await admin('PUT', `/admin/courses/${courseId}/instructors`, {
      instructors: facultyProfileIds.map((facultyProfileId, index) => ({
        facultyProfileId,
        isPrimary: index === 0,
      })),
    }),
    200,
  );
}

type Faculty = Awaited<ReturnType<typeof newFaculty>>;
type Student = Awaited<ReturnType<typeof newStudent>>;

/**
 * Course A (Alice teaches; Sam enrolled) and course B (Bob teaches; Tara enrolled), both
 * published and free. Each has one published VIDEO lesson with a video link.
 */
let alice: Faculty;
let bob: Faculty;
let sam: Student;
let tara: Student;
let courseA: Awaited<ReturnType<typeof createPublishableCourse>>;
let courseB: Awaited<ReturnType<typeof createPublishableCourse>>;

beforeEach(async () => {
  await resetAuthState();
  admin = apiAs(new TestClient(baseUrl), await tokenFor(new TestClient(baseUrl), 'ADMIN'));
  [alice, bob, sam, tara] = await Promise.all([
    newFaculty(),
    newFaculty(),
    newStudent(),
    newStudent(),
  ]);
  courseA = await createPublishableCourse(admin, { priceMinor: 0, currency: 'INR' });
  courseB = await createPublishableCourse(admin, { priceMinor: 0, currency: 'INR' });
  await assign(courseA.courseId, alice.facultyProfileId);
  await assign(courseB.courseId, bob.facultyProfileId);
  for (const [student, course] of [
    [sam, courseA],
    [tara, courseB],
  ] as const) {
    expectStatus(await admin('POST', `/admin/courses/${course.courseId}/publish`), 200);
    expectStatus(await student.api('POST', `/student/courses/${course.courseId}/enroll`), 201);
  }
});

async function createAssignment(faculty: Faculty, chapterId: string, overrides = {}) {
  const response = await faculty.api<FacultyAssignmentDetail>(
    'POST',
    `/faculty/chapters/${chapterId}/assignments`,
    {
      title: 'Quadratics worksheet',
      instructions: 'Solve questions 1–10 and show your working.',
      maxMarks: 20,
      dueAt: inDays(7),
      status: 'PUBLISHED',
      ...overrides,
    },
  );
  expectStatus(response, 201);
  return response.body.data;
}

async function submitAs(student: Student, lessonId: string, body = 'x² − 5x + 6 = 0 → x = 2, 3') {
  const response = await student.api<StudentAssignmentDto>(
    'POST',
    `/student/lessons/${lessonId}/submission`,
    { body },
  );
  expectStatus(response, 201);
  return response.body.data;
}

async function onlySubmission(faculty: Faculty) {
  const list = await faculty.api<Paginated<SubmissionListItem>>('GET', '/faculty/submissions');
  expectStatus(list, 200);
  assert.equal(list.body.data.items.length, 1);
  return list.body.data.items[0]!;
}

// --- Authorization --------------------------------------------------------------------------

describe('faculty portal authorization', () => {
  it('requires a signed-in FACULTY account', async () => {
    const visitor = apiAs(new TestClient(baseUrl), undefined);
    expectStatus(await visitor('GET', '/faculty/dashboard'), 401);
    expectStatus(await sam.api('GET', '/faculty/dashboard'), 403);
    expectStatus(await sam.api('GET', `/faculty/courses/${courseA.courseId}/curriculum`), 403);
    // A faculty profile is not an admin account, and an admin is not faculty.
    expectStatus(await admin('GET', '/faculty/dashboard'), 403);
    expectStatus(await alice.api('GET', '/admin/courses'), 403);
    // Administrators' existing permissions keep working.
    expectStatus(await admin('GET', `/admin/courses/${courseA.courseId}`), 200);
    expectStatus(await admin('GET', `/admin/courses/${courseA.courseId}/curriculum`), 200);
  });

  it('shows assigned courses only and rejects other course ids', async () => {
    const list = await alice.api<Paginated<FacultyCourseCard>>('GET', '/faculty/courses');
    expectStatus(list, 200);
    assert.deepEqual(
      list.body.data.items.map((course) => course.id),
      [courseA.courseId],
    );
    assert.equal(list.body.data.items[0]!.isPrimary, true);
    assert.equal(list.body.data.items[0]!.activeStudents, 1);

    expectStatus(await alice.api('GET', `/faculty/courses/${courseA.courseId}`), 200);
    expectStatus(await alice.api('GET', `/faculty/courses/${courseB.courseId}`), 403);
    expectStatus(await alice.api('GET', `/faculty/courses/${crypto.randomUUID()}`), 404);
    expectStatus(await alice.api('GET', `/faculty/courses/${courseB.courseId}/curriculum`), 403);
    expectStatus(await alice.api('GET', `/faculty/courses/${courseB.courseId}/performance`), 403);
    expectStatus(await alice.api('GET', `/faculty/students?courseId=${courseB.courseId}`), 403);
    expectStatus(await alice.api('GET', `/faculty/live-classes?courseId=${courseB.courseId}`), 403);
  });

  it('cannot change assignments, roles, enrolments or publication', async () => {
    expectStatus(
      await alice.api('PUT', `/admin/courses/${courseB.courseId}/instructors`, {
        instructors: [{ facultyProfileId: alice.facultyProfileId, isPrimary: true }],
      }),
      403,
    );
    expectStatus(await alice.api('POST', `/admin/courses/${courseA.courseId}/unpublish`), 403);
    expectStatus(
      await alice.api('POST', `/admin/courses/${courseA.courseId}/enrollments`, {}),
      403,
    );
    // There is simply no faculty route for these.
    expectStatus(await alice.api('POST', `/faculty/courses/${courseA.courseId}/publish`), 404);
    expectStatus(
      await alice.api('PUT', `/faculty/courses/${courseA.courseId}/instructors`, {}),
      404,
    );
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseA.courseId } });
    assert.equal(course.status, 'PUBLISHED');
  });

  it('loses access as soon as the administrator removes the assignment', async () => {
    expectStatus(await alice.api('GET', `/faculty/courses/${courseA.courseId}`), 200);
    await assign(courseA.courseId, bob.facultyProfileId);
    expectStatus(await alice.api('GET', `/faculty/courses/${courseA.courseId}`), 403);
    expectStatus(await bob.api('GET', `/faculty/courses/${courseA.courseId}`), 200);
  });

  it('enforces each faculty permission at the route', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'FACULTY' } });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: 'submissions.grade_assigned' },
    });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    expectStatus(await alice.api('GET', '/faculty/submissions'), 403);
    expectStatus(await alice.api('GET', '/faculty/courses'), 200);
  });
});

// --- Content management ---------------------------------------------------------------------

describe('faculty content management', () => {
  it('creates and edits lessons and resources in an assigned chapter', async () => {
    const created = await alice.api<{ id: string; status: string }>(
      'POST',
      `/faculty/chapters/${courseA.chapterId}/lessons`,
      { title: 'Worked examples', contentType: 'PDF' },
    );
    expectStatus(created, 201);
    assert.equal(created.body.data.status, 'DRAFT');
    const lessonId = created.body.data.id;

    expectStatus(
      await alice.api('POST', `/faculty/lessons/${lessonId}/resources`, {
        title: 'Worked examples (PDF)',
        type: 'PDF',
        location: { kind: 'external', externalUrl: 'https://files.example.com/examples.pdf' },
      }),
      201,
    );
    expectStatus(
      await alice.api('PATCH', `/faculty/lessons/${lessonId}`, { title: 'Worked examples 1' }),
      200,
    );

    const tree = await alice.api<CurriculumTreeDto>(
      'GET',
      `/faculty/courses/${courseA.courseId}/curriculum`,
    );
    const lesson = tree.body.data.modules[0]!.chapters[0]!.lessons.find((l) => l.id === lessonId);
    assert.equal(lesson?.title, 'Worked examples 1');
    assert.equal(lesson?.resources.length, 1);

    // Saving a draft lesson does not publish anything to students.
    const curriculum = await sam.api<{ modules: { chapters: { lessons: { id: string }[] }[] }[] }>(
      'GET',
      `/student/courses/${courseA.courseId}/curriculum`,
    );
    const visible = curriculum.body.data.modules.flatMap((m) =>
      m.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
    );
    assert.ok(!visible.includes(lessonId));
  });

  it('rejects unsafe links, unconfigured storage and another course’s content', async () => {
    for (const externalUrl of ['javascript:alert(1)', 'http://files.example.com/a.pdf']) {
      expectStatus(
        await alice.api('POST', `/faculty/lessons/${courseA.lessonId}/resources`, {
          title: 'Bad',
          type: 'PDF',
          location: { kind: 'external', externalUrl },
        }),
        422,
      );
    }
    expectStatus(
      await alice.api('POST', `/faculty/lessons/${courseA.lessonId}/resources`, {
        title: 'Upload',
        type: 'VIDEO',
        location: { kind: 'storage', storageProvider: 's3', storageKey: 'videos/a.mp4' },
      }),
      422,
    );
    expectStatus(
      await alice.api('POST', `/faculty/chapters/${courseB.chapterId}/lessons`, {
        title: 'Intrusion',
        contentType: 'TEXT',
      }),
      403,
    );
    expectStatus(
      await alice.api('PATCH', `/faculty/lessons/${courseB.lessonId}`, { title: 'Hacked' }),
      403,
    );
    expectStatus(await alice.api('DELETE', `/faculty/resources/${courseB.resourceId}`), 403);
    // A foreign id in a reorder list is rejected.
    expectStatus(
      await alice.api('PUT', `/faculty/chapters/${courseA.chapterId}/lessons/order`, {
        orderedIds: [courseB.lessonId],
      }),
      422,
    );
    const untouched = await prisma.lesson.findUniqueOrThrow({ where: { id: courseB.lessonId } });
    assert.notEqual(untouched.title, 'Hacked');
  });

  it('keeps the course publication rules', async () => {
    // Unpublishing the only published lesson would make the live course ineligible → 422.
    expectStatus(
      await alice.api('PATCH', `/faculty/lessons/${courseA.lessonId}`, { status: 'DRAFT' }),
      422,
    );
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: courseA.lessonId } });
    assert.equal(lesson.status, 'PUBLISHED');
  });
});

// --- Assignments, submissions, grading, results ---------------------------------------------

describe('assignment → submission → review → marks → feedback → result', () => {
  it('runs the whole workflow with server-side validation and release control', async () => {
    const assignment = await createAssignment(alice, courseA.chapterId);
    assert.equal(assignment.settings?.maxMarks, 20);
    assert.equal(assignment.status, 'PUBLISHED');
    assert.equal(
      (await prisma.course.findUniqueOrThrow({ where: { id: courseA.courseId } })).status,
      'PUBLISHED',
    );

    // Student side: open, submit once.
    const open = await sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    expectStatus(open, 200);
    assert.equal(open.body.data.acceptingSubmissions, true);
    assert.equal(open.body.data.submission, null);
    expectStatus(
      await sam.api('POST', `/student/lessons/${assignment.lessonId}/submission`, {
        body: 'Answer',
        attachmentUrl: 'javascript:alert(1)',
      }),
      422,
    );
    const submitted = await submitAs(sam, assignment.lessonId);
    assert.equal(submitted.submission?.state, 'SUBMITTED');
    expectStatus(
      await sam.api('POST', `/student/lessons/${assignment.lessonId}/submission`, {
        body: 'Again',
      }),
      409,
    );
    // A student of another course cannot see or submit it.
    expectStatus(await tara.api('GET', `/student/lessons/${assignment.lessonId}/assignment`), 403);

    // Faculty side: only Alice sees it.
    const item = await onlySubmission(alice);
    assert.equal(item.status, 'SUBMITTED');
    assert.equal(item.late, false);
    const bobList = await bob.api<Paginated<SubmissionListItem>>('GET', '/faculty/submissions');
    assert.equal(bobList.body.data.items.length, 0);
    expectStatus(await bob.api('GET', `/faculty/submissions/${item.id}`), 403);
    expectStatus(
      await bob.api('PUT', `/faculty/submissions/${item.id}/grade`, { marksAwarded: 1 }),
      403,
    );

    const detail = await alice.api<SubmissionDetailDto>('GET', `/faculty/submissions/${item.id}`);
    assert.equal(detail.body.data.body, 'x² − 5x + 6 = 0 → x = 2, 3');

    // Marks are validated on the server; over-posting is rejected.
    for (const marksAwarded of [21, -1, 2.5]) {
      expectStatus(
        await alice.api('PUT', `/faculty/submissions/${item.id}/grade`, { marksAwarded }),
        422,
      );
    }
    expectStatus(
      await alice.api('PUT', `/faculty/submissions/${item.id}/grade`, {
        marksAwarded: 5,
        resultReleasedAt: new Date().toISOString(),
      }),
      422,
    );
    // Releasing before grading is refused.
    expectStatus(await alice.api('POST', `/faculty/submissions/${item.id}/release`), 409);

    const graded = await alice.api<SubmissionDetailDto>(
      'PUT',
      `/faculty/submissions/${item.id}/grade`,
      {
        marksAwarded: 18,
        feedback: 'Good working; check question 7.',
        expectedUpdatedAt: detail.body.data.updatedAt,
      },
    );
    expectStatus(graded, 200);
    assert.equal(graded.body.data.status, 'GRADED');
    assert.equal(graded.body.data.marksAwarded, 18);
    // The stale editor gets 409 instead of overwriting.
    expectStatus(
      await alice.api('PUT', `/faculty/submissions/${item.id}/grade`, {
        marksAwarded: 3,
        expectedUpdatedAt: detail.body.data.updatedAt,
      }),
      409,
    );

    // Saved but unreleased: the student sees no mark — not even that it was graded.
    const hidden = await sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.equal(hidden.body.data.submission?.state, 'SUBMITTED');
    assert.equal(hidden.body.data.submission?.result, null);
    assert.ok(!hidden.text.includes('check question 7'));
    const noResults = await sam.api<Paginated<StudentResultItem>>('GET', '/student/results');
    assert.equal(noResults.body.data.items.length, 0);

    // Release.
    const released = await alice.api<SubmissionDetailDto>(
      'POST',
      `/faculty/submissions/${item.id}/release`,
    );
    expectStatus(released, 200);
    assert.ok(released.body.data.resultReleasedAt);
    const again = await alice.api('POST', `/faculty/submissions/${item.id}/release`);
    expectStatus(again, 200);
    assert.equal(again.body.message, 'Result was already released');
    expectStatus(
      await alice.api('PUT', `/faculty/submissions/${item.id}/grade`, { marksAwarded: 20 }),
      409,
    );

    const visible = await sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${assignment.lessonId}/assignment`,
    );
    assert.deepEqual(
      {
        state: visible.body.data.submission?.state,
        marks: visible.body.data.submission?.result?.marksAwarded,
        max: visible.body.data.submission?.result?.maxMarks,
        feedback: visible.body.data.submission?.result?.feedback,
      },
      { state: 'RESULT_RELEASED', marks: 18, max: 20, feedback: 'Good working; check question 7.' },
    );
    const results = await sam.api<Paginated<StudentResultItem>>('GET', '/student/results');
    assert.equal(results.body.data.items.length, 1);
    assert.equal(results.body.data.items[0]!.marksAwarded, 18);
    const taraResults = await tara.api<Paginated<StudentResultItem>>('GET', '/student/results');
    assert.equal(taraResults.body.data.items.length, 0);

    // The grading record persisted with its reviewer.
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(row.gradedById, alice.userId);
    assert.equal(row.marksAwarded, 18);
  });

  it('validates assignment ownership and settings', async () => {
    expectStatus(
      await bob.api('POST', `/faculty/chapters/${courseA.chapterId}/assignments`, {
        title: 'Intrusion',
        instructions: 'x',
        maxMarks: 10,
      }),
      403,
    );
    for (const bad of [
      { dueAt: inDays(-1) },
      { maxMarks: 0 },
      { maxMarks: 1001 },
      { dueAt: 'soon' },
    ]) {
      const response = await alice.api(
        'POST',
        `/faculty/chapters/${courseA.chapterId}/assignments`,
        {
          title: 'Worksheet',
          instructions: 'Do it',
          maxMarks: 10,
          ...bad,
        },
      );
      expectStatus(response, 422);
    }
    const draft = await createAssignment(alice, courseA.chapterId, { status: 'DRAFT' });
    // A draft assignment is invisible to students.
    expectStatus(await sam.api('GET', `/student/lessons/${draft.lessonId}/assignment`), 404);
    expectStatus(await bob.api('GET', `/faculty/assignments/${draft.lessonId}`), 403);
    // Settings on a non-assignment lesson are refused.
    expectStatus(
      await alice.api('PUT', `/faculty/lessons/${courseA.lessonId}/assignment`, { maxMarks: 10 }),
      404,
    );
  });

  it('never deletes or rewrites student work through curriculum or settings edits', async () => {
    const assignment = await createAssignment(alice, courseA.chapterId);
    await submitAs(sam, assignment.lessonId);
    const item = await onlySubmission(alice);
    expectStatus(
      await alice.api('PUT', `/faculty/submissions/${item.id}/grade`, { marksAwarded: 10 }),
      200,
    );

    expectStatus(await alice.api('DELETE', `/faculty/lessons/${assignment.lessonId}`), 409);
    expectStatus(await admin('DELETE', `/admin/lessons/${assignment.lessonId}`), 409);
    expectStatus(
      await alice.api('PATCH', `/faculty/lessons/${assignment.lessonId}`, { contentType: 'TEXT' }),
      409,
    );
    // Max marks are fixed once something is graded; the due date may still move.
    expectStatus(
      await alice.api('PUT', `/faculty/lessons/${assignment.lessonId}/assignment`, {
        maxMarks: 50,
      }),
      409,
    );
    expectStatus(
      await alice.api('PUT', `/faculty/lessons/${assignment.lessonId}/assignment`, {
        maxMarks: 20,
        dueAt: inDays(14),
      }),
      200,
    );
    expectStatus(
      await alice.api('PATCH', `/faculty/lessons/${assignment.lessonId}`, {
        title: 'Renamed worksheet',
        body: 'New instructions',
      }),
      200,
    );
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(row.body, 'x² − 5x + 6 = 0 → x = 2, 3');
    assert.equal(row.marksAwarded, 10);
  });

  it('flags late work without penalising it, and refuses submissions that are not open', async () => {
    const assignment = await createAssignment(alice, courseA.chapterId);
    await prisma.assignment.update({
      where: { lessonId: assignment.lessonId },
      data: { dueAt: new Date(Date.now() - 60_000) },
    });
    const submitted = await submitAs(sam, assignment.lessonId);
    assert.equal(submitted.submission?.late, true);
    assert.equal((await onlySubmission(alice)).late, true);

    // An ASSIGNMENT lesson without settings (e.g. created by an admin) is not open for submission.
    const placeholder = await admin<{ id: string }>(
      'POST',
      `/admin/chapters/${courseA.chapterId}/lessons`,
      {
        title: 'Offline task',
        contentType: 'ASSIGNMENT',
        body: 'Bring it to class',
        status: 'PUBLISHED',
      },
    );
    expectStatus(placeholder, 201);
    const view = await sam.api<StudentAssignmentDto>(
      'GET',
      `/student/lessons/${placeholder.body.data.id}/assignment`,
    );
    assert.equal(view.body.data.acceptingSubmissions, false);
    expectStatus(
      await sam.api('POST', `/student/lessons/${placeholder.body.data.id}/submission`, {
        body: 'x',
      }),
      409,
    );
    // Faculty can open it by adding settings.
    expectStatus(
      await alice.api('PUT', `/faculty/lessons/${placeholder.body.data.id}/assignment`, {
        maxMarks: 10,
      }),
      200,
    );
    expectStatus(
      await sam.api('POST', `/student/lessons/${placeholder.body.data.id}/submission`, {
        body: 'x',
      }),
      201,
    );
  });
});

// --- Live classes ---------------------------------------------------------------------------

describe('live-class scheduling', () => {
  const schedule = (faculty: Faculty, courseId: string, body: Record<string, unknown> = {}) =>
    faculty.api<LiveClassDto>('POST', `/faculty/courses/${courseId}/live-classes`, {
      title: 'Doubt-clearing session',
      startsAt: inDays(2),
      durationMinutes: 60,
      ...body,
    });

  it('schedules, lists, updates and cancels classes of assigned courses', async () => {
    const created = await schedule(alice, courseA.courseId, {
      joinUrl: 'https://meet.example.com/abc-defg-hij',
    });
    expectStatus(created, 201);
    assert.equal(created.body.data.provider, 'manual');
    assert.equal(created.body.data.status, 'SCHEDULED');
    const plain = await schedule(alice, courseA.courseId, { title: 'No link yet' });
    expectStatus(plain, 201);
    assert.equal(plain.body.data.joinUrl, null);
    assert.equal(plain.body.data.provider, null);

    for (const bad of [
      { startsAt: inDays(-1) },
      { startsAt: inDays(400) },
      { durationMinutes: 5 },
      { durationMinutes: 600 },
      { startsAt: '2026-11-02T10:00' }, // no offset
      { joinUrl: 'javascript:alert(1)' },
    ]) {
      expectStatus(await schedule(alice, courseA.courseId, bad), 422);
    }
    expectStatus(await schedule(bob, courseA.courseId), 403);

    const list = await alice.api<Paginated<LiveClassDto>>('GET', '/faculty/live-classes');
    assert.equal(list.body.data.items.length, 2);
    expectStatus(
      await bob.api('PATCH', `/faculty/live-classes/${created.body.data.id}`, { title: 'Mine' }),
      403,
    );
    const updated = await alice.api<LiveClassDto>(
      'PATCH',
      `/faculty/live-classes/${plain.body.data.id}`,
      { joinUrl: 'https://meet.example.com/xyz', durationMinutes: 45 },
    );
    expectStatus(updated, 200);
    assert.equal(updated.body.data.provider, 'manual');
    assert.equal(updated.body.data.durationMinutes, 45);

    // Students of the course see it with the link; others do not see it at all.
    const samClasses = await sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    assert.equal(samClasses.body.data.items.length, 2);
    assert.ok(
      samClasses.body.data.items.some((c) => c.joinUrl === 'https://meet.example.com/abc-defg-hij'),
    );
    const taraClasses = await tara.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    assert.equal(taraClasses.body.data.items.length, 0);
    // Public course pages never leak meeting links.
    const publicPage = await apiAs(new TestClient(baseUrl), undefined)(
      'GET',
      `/courses/${courseA.slug}`,
    );
    expectStatus(publicPage, 200);
    assert.ok(!publicPage.text.includes('meet.example.com'));

    const cancelled = await alice.api<LiveClassDto>(
      'POST',
      `/faculty/live-classes/${created.body.data.id}/cancel`,
    );
    expectStatus(cancelled, 200);
    assert.equal(cancelled.body.data.status, 'CANCELLED');
    assert.equal(cancelled.body.data.joinUrl, null);
    expectStatus(
      await alice.api('PATCH', `/faculty/live-classes/${created.body.data.id}`, { title: 'Back' }),
      409,
    );
    const samAfter = await sam.api<Paginated<LiveClassDto>>('GET', '/student/live-classes');
    const shown = samAfter.body.data.items.find((c) => c.id === created.body.data.id);
    assert.equal(shown?.status, 'CANCELLED');
    assert.equal(shown?.joinUrl, null);
  });

  it('puts ended classes under past and never edits them', async () => {
    const created = await schedule(alice, courseA.courseId);
    await prisma.liveClassSession.update({
      where: { id: created.body.data.id },
      data: { startsAt: new Date(Date.now() - 3 * 3_600_000) },
    });
    const upcoming = await alice.api<Paginated<LiveClassDto>>('GET', '/faculty/live-classes');
    assert.equal(upcoming.body.data.items.length, 0);
    const past = await alice.api<Paginated<LiveClassDto>>('GET', '/faculty/live-classes?when=past');
    assert.equal(past.body.data.items.length, 1);
    expectStatus(
      await alice.api('POST', `/faculty/live-classes/${created.body.data.id}/cancel`),
      409,
    );
  });
});

// --- Dashboard, students, performance -------------------------------------------------------

describe('dashboard, students and performance', () => {
  it('derives every figure from the faculty member’s own courses', async () => {
    const assignment = await createAssignment(alice, courseA.chapterId);
    await submitAs(sam, assignment.lessonId);
    // Noise in Bob's course must not leak into Alice's figures.
    const other = await createAssignment(bob, courseB.chapterId);
    await submitAs(tara, other.lessonId);
    expectStatus(await sam.api('POST', `/student/lessons/${courseA.lessonId}/complete`), 200);

    const dashboard = await alice.api<FacultyDashboardDto>('GET', '/faculty/dashboard');
    expectStatus(dashboard, 200);
    assert.deepEqual(
      { ...dashboard.body.data.stats },
      {
        courses: 1,
        activeStudents: 1,
        assignments: 1,
        pendingReviews: 1,
        gradedUnreleased: 0,
        upcomingClasses: 0,
        quizLessons: 0,
      },
    );
    assert.equal(dashboard.body.data.pendingSubmissions.length, 1);
    assert.equal(dashboard.body.data.features.liveClassProvider.available, false);

    const students = await alice.api<Paginated<FacultyStudentRow>>('GET', '/faculty/students');
    assert.equal(students.body.data.items.length, 1);
    const row = students.body.data.items[0]!;
    assert.equal(row.student.userId, sam.userId);
    assert.equal(row.progress.percent, 100);
    assert.deepEqual(
      { assignments: row.work.assignments, submitted: row.work.submitted },
      { assignments: 1, submitted: 1 },
    );
    // Teaching data only — no contact details.
    assert.ok(!/"email"|"phone"/.test(students.text));

    const performance = await alice.api<CoursePerformanceDto>(
      'GET',
      `/faculty/courses/${courseA.courseId}/performance`,
    );
    expectStatus(performance, 200);
    const metrics = performance.body.data.metrics;
    assert.equal(metrics.activeStudents, 1);
    assert.equal(metrics.countableLessons, 1);
    assert.equal(metrics.averageProgressPercent, 100);
    assert.equal(metrics.completedStudents, 1);
    assert.equal(metrics.distribution['100'], 1);
    assert.equal(metrics.publishedAssignments, 1);
    assert.equal(metrics.submissions, 1);
    assert.equal(metrics.submissionRatePercent, 100);
    assert.equal(metrics.releasedScorePercent, null);
  });

  it('handles empty courses without fabricated numbers', async () => {
    const fresh = await createPublishableCourse(admin);
    await assign(fresh.courseId, alice.facultyProfileId);
    const performance = await alice.api<CoursePerformanceDto>(
      'GET',
      `/faculty/courses/${fresh.courseId}/performance`,
    );
    expectStatus(performance, 200);
    const metrics = performance.body.data.metrics;
    assert.equal(metrics.activeStudents, 0);
    assert.equal(metrics.averageProgressPercent, null);
    assert.equal(metrics.submissionRatePercent, null);
    assert.equal(metrics.releasedScorePercent, null);

    const detail = await alice.api<FacultyCourseDetail>(
      'GET',
      `/faculty/courses/${fresh.courseId}`,
    );
    expectStatus(detail, 200);
    assert.equal(detail.body.data.activeStudents, 0);
    assert.ok(detail.body.data.instructors.some((item) => item.isYou));
  });
});

// --- Profile --------------------------------------------------------------------------------

describe('faculty profile', () => {
  it('shows allocation and accepts only self-service fields', async () => {
    const profile = await alice.api<FacultyProfileDto>('GET', '/faculty/profile');
    expectStatus(profile, 200);
    assert.deepEqual(
      profile.body.data.courses.map((course) => course.id),
      [courseA.courseId],
    );
    assert.equal(profile.body.data.subjects.length, 1);

    const updated = await alice.api<FacultyProfileDto>('PATCH', '/faculty/profile', {
      bio: 'Teaches mathematics.',
      experienceYears: 6,
    });
    expectStatus(updated, 200);
    assert.equal(updated.body.data.bio, 'Teaches mathematics.');

    for (const forbidden of [
      { isPublic: true },
      { designation: 'Head of Department' },
      { employeeCode: 'X-1' },
      { roles: ['ADMIN'] },
    ]) {
      expectStatus(await alice.api('PATCH', '/faculty/profile', forbidden), 422);
    }
    const row = await prisma.facultyProfile.findUniqueOrThrow({ where: { userId: alice.userId } });
    assert.equal(row.isPublic, false);
  });
});
