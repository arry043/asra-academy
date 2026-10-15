/**
 * PHASE 06 — course management: CRUD, relations, slugs, pricing, faculty assignment and the
 * publication lifecycle through `/api/v1/admin/courses` (real middleware, real database).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AdminCourseDetail, FacultyOptionDto, PublicationIssue } from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { evaluatePublication } from '../src/modules/courses/publication.js';
import { provision, resetAuthState } from './support/auth.js';
import {
  apiAs,
  createAcademicBasics,
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
beforeEach(async () => {
  await resetAuthState();
  const client = new TestClient(baseUrl);
  admin = apiAs(client, await tokenFor(client, 'ADMIN'));
});

type Issue = { path: string[]; message: string; code?: string };
const fields = (response: { body: { error?: { details?: unknown } } }) =>
  ((response.body.error?.details as Issue[]) ?? []).map((issue) => issue.path[0]);

describe('course create and update', () => {
  it('creates a DRAFT course with validated relations and returns the full detail', async () => {
    const basics = await createAcademicBasics(admin);
    const response = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Mathematics — Class 10',
      summary: 'Board exam preparation',
      categoryId: basics.categoryId,
      classId: basics.classId,
      subjectId: basics.subjectId,
      durationMinutes: 2400,
      priceMinor: 250000,
      currency: 'INR',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      visibility: 'UNLISTED',
      thumbnailUrl: 'https://images.example.com/maths.png',
      status: undefined,
    });
    expectStatus(response, 201);
    const course = response.body.data;
    assert.equal(course.status, 'DRAFT');
    assert.equal(course.slug, 'mathematics-class-10');
    assert.equal(course.class?.id, basics.classId);
    assert.equal(course.subject?.id, basics.subjectId);
    assert.equal(course.category?.id, basics.categoryId);
    assert.equal(course.priceMinor, 250000);
    assert.equal(course.visibility, 'UNLISTED');
    assert.equal(course.publication.eligible, false);
    assert.deepEqual(course.counts, {
      modules: 0,
      chapters: 0,
      lessons: 0,
      publishedLessons: 0,
      resources: 0,
    });
  });

  it('never lets the client set status or publishedAt directly', async () => {
    const response = await admin('POST', '/admin/courses', {
      title: 'Sneaky',
      status: 'PUBLISHED',
    });
    assert.equal(response.status, 422);
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Honest course',
    });
    const patched = await admin('PATCH', `/admin/courses/${course.body.data.id}`, {
      publishedAt: new Date().toISOString(),
    });
    assert.equal(patched.status, 422);
  });

  it('generates unique slugs predictably and validates custom slugs', async () => {
    const first = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Urdu Grammar',
    });
    const second = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Urdu Grammar',
    });
    const third = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Urdu  grammar!',
    });
    assert.deepEqual(
      [first.body.data.slug, second.body.data.slug, third.body.data.slug],
      ['urdu-grammar', 'urdu-grammar-2', 'urdu-grammar-3'],
    );
    // Non-Latin titles fall back to "course".
    const urdu = await admin<AdminCourseDetail>('POST', '/admin/courses', { title: 'اردو زبان' });
    assert.equal(urdu.body.data.slug, 'course');

    const custom = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Any title',
      slug: 'my-custom-course',
    });
    assert.equal(custom.body.data.slug, 'my-custom-course');

    const taken = await admin('POST', '/admin/courses', { title: 'Other', slug: 'urdu-grammar' });
    assert.equal(taken.status, 409);
    assert.deepEqual(fields(taken), ['slug']);

    const invalid = await admin('POST', '/admin/courses', { title: 'Other', slug: 'Bad Slug' });
    assert.equal(invalid.status, 422);

    // Programme pages own /courses/english etc.
    const reserved = await admin('POST', '/admin/courses', { title: 'English', slug: 'english' });
    assert.equal(reserved.status, 422);
    assert.deepEqual(fields(reserved), ['slug']);

    const renamed = await admin<AdminCourseDetail>(
      'PATCH',
      `/admin/courses/${first.body.data.id}`,
      {
        title: 'Urdu Grammar — Level 1',
      },
    );
    assert.equal(renamed.body.data.slug, 'urdu-grammar', 'renaming keeps the published URL stable');
  });

  it('validates class, stream, subject and category relations', async () => {
    const basics = await createAcademicBasics(admin);
    const missing = '00000000-0000-4000-8000-000000000000';

    for (const key of ['categoryId', 'classId', 'subjectId', 'streamId'] as const) {
      const response = await admin('POST', '/admin/courses', {
        title: 'Broken relation',
        classId: basics.classId,
        [key]: missing,
      });
      assert.equal(response.status, 422, key);
      assert.ok(fields(response).includes(key), key);
    }

    // A stream needs a class of the same academic level.
    const otherLevel = await admin<{ id: string }>('POST', '/admin/academic-levels', {
      name: 'Classes 11–12',
    });
    const stream = await admin<{ id: string }>('POST', '/admin/streams', {
      academicLevelId: otherLevel.body.data.id,
      name: 'Science',
    });
    const mismatch = await admin('POST', '/admin/courses', {
      title: 'Mismatch',
      classId: basics.classId,
      streamId: stream.body.data.id,
    });
    assert.equal(mismatch.status, 422);
    assert.deepEqual(fields(mismatch), ['streamId']);
    const noClass = await admin('POST', '/admin/courses', {
      title: 'No class',
      streamId: stream.body.data.id,
    });
    assert.equal(noClass.status, 422);

    // Newly linking an inactive row is refused …
    await admin('PATCH', `/admin/course-categories/${basics.categoryId}`, { isActive: false });
    const inactive = await admin('POST', '/admin/courses', {
      title: 'Inactive',
      categoryId: basics.categoryId,
    });
    assert.equal(inactive.status, 422);
    assert.deepEqual(fields(inactive), ['categoryId']);
  });

  it('keeps an already-linked relation that was deactivated later, so other edits still save', async () => {
    const basics = await createAcademicBasics(admin);
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Linked course',
      subjectId: basics.subjectId,
    });
    await admin('PATCH', `/admin/subjects/${basics.subjectId}`, { isActive: false });
    const response = await admin<AdminCourseDetail>(
      'PATCH',
      `/admin/courses/${course.body.data.id}`,
      {
        title: 'Linked course (renamed)',
        subjectId: basics.subjectId,
      },
    );
    expectStatus(response, 200);
    assert.equal(response.body.data.subject?.isActive, false);
  });

  it('validates price and discount values (no negative or out-of-range amounts)', async () => {
    const bad: [Record<string, unknown>, string][] = [
      [{ priceMinor: -100, currency: 'INR' }, 'priceMinor'],
      [{ priceMinor: 10.5, currency: 'INR' }, 'priceMinor'],
      [{ priceMinor: 1000 }, 'currency'],
      [{ priceMinor: 1000, currency: 'USD' }, 'currency'],
      [
        { priceMinor: 1000, currency: 'INR', discountType: 'PERCENTAGE', discountValue: 101 },
        'discountValue',
      ],
      [
        { priceMinor: 1000, currency: 'INR', discountType: 'PERCENTAGE', discountValue: 0 },
        'discountValue',
      ],
      [
        { priceMinor: 1000, currency: 'INR', discountType: 'FIXED_AMOUNT', discountValue: 1001 },
        'discountValue',
      ],
      [
        { priceMinor: 0, currency: 'INR', discountType: 'PERCENTAGE', discountValue: 10 },
        'discountType',
      ],
      [{ discountType: 'PERCENTAGE', discountValue: 10 }, 'discountType'],
      // The error points at the missing half of the pair.
      [{ priceMinor: 1000, currency: 'INR', discountType: 'PERCENTAGE' }, 'discountValue'],
      [{ durationMinutes: 0 }, 'durationMinutes'],
    ];
    for (const [body, field] of bad) {
      const response = await admin('POST', '/admin/courses', { title: 'Priced course', ...body });
      assert.equal(response.status, 422, JSON.stringify(body));
      assert.ok(
        fields(response).includes(field),
        `${JSON.stringify(body)} → ${fields(response).join()}`,
      );
    }

    const free = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Free course',
      priceMinor: 0,
      currency: 'INR',
    });
    expectStatus(free, 201);

    // A partial PATCH is checked against the stored values.
    const paid = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Paid course',
      priceMinor: 50000,
      currency: 'INR',
    });
    const id = paid.body.data.id;
    expectStatus(
      await admin('PATCH', `/admin/courses/${id}`, {
        discountType: 'FIXED_AMOUNT',
        discountValue: 5000,
      }),
      200,
    );
    const tooBig = await admin('PATCH', `/admin/courses/${id}`, { priceMinor: 1000 });
    assert.equal(tooBig.status, 422, 'lowering the price below a fixed discount is refused');
    assert.deepEqual(fields(tooBig), ['discountValue']);
  });

  it('validates thumbnail URLs (https on a public domain only)', async () => {
    for (const thumbnailUrl of [
      'http://images.example.com/a.png',
      'javascript:alert(1)',
      'https://localhost/a.png',
      'https://user:pass@images.example.com/a.png',
    ]) {
      const response = await admin('POST', '/admin/courses', { title: 'Thumb', thumbnailUrl });
      assert.equal(response.status, 422, thumbnailUrl);
    }
  });

  it('lists with search, filters and pagination, newest change first', async () => {
    const basics = await createAcademicBasics(admin);
    await admin('POST', '/admin/courses', { title: 'Algebra basics', classId: basics.classId });
    await admin('POST', '/admin/courses', {
      title: 'Geometry basics',
      subjectId: basics.subjectId,
    });
    await admin('POST', '/admin/courses', { title: 'Arabic script', visibility: 'PRIVATE' });

    const all = await admin<{ items: AdminCourseDetail[]; pagination: { total: number } }>(
      'GET',
      '/admin/courses',
    );
    assert.equal(all.body.data.pagination.total, 3);
    assert.equal(all.body.data.items[0]?.title, 'Arabic script');

    const byQuery = await admin<{ items: AdminCourseDetail[] }>(
      'GET',
      '/admin/courses?q=basics&pageSize=1',
    );
    assert.equal(byQuery.body.data.items.length, 1);
    const byClass = await admin<{ items: AdminCourseDetail[] }>(
      'GET',
      `/admin/courses?classId=${basics.classId}`,
    );
    assert.deepEqual(
      byClass.body.data.items.map((c) => c.title),
      ['Algebra basics'],
    );
    const byVisibility = await admin<{ items: AdminCourseDetail[] }>(
      'GET',
      '/admin/courses?visibility=PRIVATE',
    );
    assert.deepEqual(
      byVisibility.body.data.items.map((c) => c.title),
      ['Arabic script'],
    );
    const byStatus = await admin<{ items: AdminCourseDetail[] }>(
      'GET',
      '/admin/courses?status=PUBLISHED',
    );
    assert.equal(byStatus.body.data.items.length, 0);
    assert.equal((await admin('GET', '/admin/courses?status=LIVE')).status, 422);
  });

  it('refuses stale edits when expectedUpdatedAt no longer matches (optimistic concurrency)', async () => {
    const created = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Concurrent',
    });
    const loadedAt = created.body.data.updatedAt;
    expectStatus(
      await admin('PATCH', `/admin/courses/${created.body.data.id}`, {
        title: 'Edit one',
        expectedUpdatedAt: loadedAt,
      }),
      200,
    );
    const stale = await admin('PATCH', `/admin/courses/${created.body.data.id}`, {
      title: 'Edit two',
      expectedUpdatedAt: loadedAt,
    });
    assert.equal(stale.status, 409);
    const course = await prisma.course.findUniqueOrThrow({ where: { id: created.body.data.id } });
    assert.equal(course.title, 'Edit one');
  });
});

describe('faculty assignment', () => {
  it('lists faculty options without private data and assigns exactly one primary', async () => {
    const lecturer = await createFaculty('Dr. Test Lecturer');
    await provision('STUDENT');
    const options = await admin<FacultyOptionDto[]>('GET', '/admin/faculty');
    expectStatus(options, 200);
    assert.deepEqual(
      options.body.data.map((option) => option.facultyProfileId),
      [lecturer.facultyProfileId],
    );
    assert.ok(!options.text.includes('@example.test'), 'faculty options must not expose emails');

    const second = await createFaculty();
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Team taught',
    });
    const id = course.body.data.id;
    const assigned = await admin<AdminCourseDetail>('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [
        { facultyProfileId: second.facultyProfileId, isPrimary: false },
        { facultyProfileId: lecturer.facultyProfileId, isPrimary: true },
      ],
    });
    expectStatus(assigned, 200);
    assert.deepEqual(
      assigned.body.data.instructors.map((item) => [item.fullName, item.isPrimary]),
      [
        ['Dr. Test Lecturer', true],
        ['Test FACULTY', false],
      ],
    );

    const twoPrimaries = await admin('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [
        { facultyProfileId: second.facultyProfileId, isPrimary: true },
        { facultyProfileId: lecturer.facultyProfileId, isPrimary: true },
      ],
    });
    assert.equal(twoPrimaries.status, 422);
    const duplicate = await admin('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [
        { facultyProfileId: second.facultyProfileId, isPrimary: true },
        { facultyProfileId: second.facultyProfileId, isPrimary: false },
      ],
    });
    assert.equal(duplicate.status, 422);

    const cleared = await admin<AdminCourseDetail>('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [],
    });
    assert.equal(cleared.body.data.instructors.length, 0);
  });

  it('only accepts real, active faculty (never students or unknown ids)', async () => {
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Faculty checks',
    });
    const id = course.body.data.id;

    const unknown = await admin('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [{ facultyProfileId: '00000000-0000-4000-8000-000000000000', isPrimary: true }],
    });
    assert.equal(unknown.status, 422);

    // A user who has a faculty profile row but not the FACULTY role is not faculty.
    const student = await provision('STUDENT');
    const fake = await prisma.facultyProfile.create({ data: { userId: student.id } });
    const notFaculty = await admin('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [{ facultyProfileId: fake.id, isPrimary: true }],
    });
    assert.equal(notFaculty.status, 422);

    const suspended = await createFaculty();
    await prisma.user.update({ where: { id: suspended.user.id }, data: { status: 'SUSPENDED' } });
    const inactive = await admin('PUT', `/admin/courses/${id}/instructors`, {
      instructors: [{ facultyProfileId: suspended.facultyProfileId, isPrimary: true }],
    });
    assert.equal(inactive.status, 422);
    assert.equal(await prisma.courseInstructor.count({ where: { courseId: id } }), 0);
  });
});

describe('publication lifecycle', () => {
  it('lists every unmet requirement and refuses to publish an incomplete course', async () => {
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Incomplete',
    });
    const response = await admin('POST', `/admin/courses/${course.body.data.id}/publish`);
    assert.equal(response.status, 422);
    const codes = (response.body.error?.details as PublicationIssue[]).map((issue) => issue.code);
    assert.deepEqual(codes, [
      'DESCRIPTION_REQUIRED',
      'PLACEMENT_REQUIRED',
      'INSTRUCTOR_REQUIRED',
      'PUBLISHED_LESSON_REQUIRED',
    ]);
    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.body.data.id } });
    assert.equal(stored.status, 'DRAFT');
    assert.equal(stored.publishedAt, null);
  });

  it('requires published lessons to have the content their type needs', async () => {
    const ids = await createPublishableCourse(admin);
    await admin('DELETE', `/admin/resources/${ids.resourceId}`);
    const response = await admin('POST', `/admin/courses/${ids.courseId}/publish`);
    assert.equal(response.status, 422);
    const issues = response.body.error?.details as PublicationIssue[];
    assert.deepEqual(
      issues.map((issue) => issue.code),
      ['LESSON_CONTENT_MISSING'],
    );
    assert.deepEqual(issues[0]?.path, ['curriculum', ids.lessonId]);
  });

  it('publishes an eligible course, then unpublishes it', async () => {
    const ids = await createPublishableCourse(admin);
    const detail = await admin<AdminCourseDetail>('GET', `/admin/courses/${ids.courseId}`);
    assert.equal(
      detail.body.data.publication.eligible,
      true,
      JSON.stringify(detail.body.data.publication),
    );

    const published = await admin<AdminCourseDetail>(
      'POST',
      `/admin/courses/${ids.courseId}/publish`,
      {
        expectedUpdatedAt: detail.body.data.updatedAt,
      },
    );
    expectStatus(published, 200);
    assert.equal(published.body.data.status, 'PUBLISHED');
    assert.ok(published.body.data.publishedAt);
    assert.equal((await admin('POST', `/admin/courses/${ids.courseId}/publish`)).status, 409);

    const unpublished = await admin<AdminCourseDetail>(
      'POST',
      `/admin/courses/${ids.courseId}/unpublish`,
    );
    expectStatus(unpublished, 200);
    assert.equal(unpublished.body.data.status, 'DRAFT');
    assert.equal(unpublished.body.data.publishedAt, null);
    assert.equal((await admin('POST', `/admin/courses/${ids.courseId}/unpublish`)).status, 409);
  });

  it('refuses a publish based on a stale view of the course', async () => {
    const ids = await createPublishableCourse(admin);
    const response = await admin('POST', `/admin/courses/${ids.courseId}/publish`, {
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
    });
    assert.equal(response.status, 409);
  });

  it('keeps a published course eligible: breaking edits are rolled back', async () => {
    const ids = await createPublishableCourse(admin);
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);

    const clearDescription = await admin('PATCH', `/admin/courses/${ids.courseId}`, {
      description: '',
    });
    assert.equal(clearDescription.status, 422);
    const removeFaculty = await admin('PUT', `/admin/courses/${ids.courseId}/instructors`, {
      instructors: [],
    });
    assert.equal(removeFaculty.status, 422);
    const deactivate = await admin('PATCH', `/admin/course-categories/${ids.categoryId}`, {
      isActive: false,
    });
    assert.equal(deactivate.status, 409);
    const deactivateClass = await admin('PATCH', `/admin/classes/${ids.classId}`, {
      isActive: false,
    });
    assert.equal(deactivateClass.status, 409);

    const course = await prisma.course.findUniqueOrThrow({ where: { id: ids.courseId } });
    assert.equal(course.description, 'Algebra, geometry and statistics for Class 10.');
    assert.equal(await prisma.courseInstructor.count({ where: { courseId: ids.courseId } }), 1);

    // Harmless edits still work.
    expectStatus(
      await admin('PATCH', `/admin/courses/${ids.courseId}`, { summary: 'Updated summary' }),
      200,
    );
  });

  it('archives and restores drafts; deletes only empty drafts', async () => {
    const ids = await createPublishableCourse(admin);
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);
    assert.equal((await admin('POST', `/admin/courses/${ids.courseId}/archive`)).status, 409);
    assert.equal((await admin('DELETE', `/admin/courses/${ids.courseId}`)).status, 409);
    await admin('POST', `/admin/courses/${ids.courseId}/unpublish`);

    const archived = await admin<AdminCourseDetail>(
      'POST',
      `/admin/courses/${ids.courseId}/archive`,
    );
    assert.equal(archived.body.data.status, 'ARCHIVED');
    assert.equal((await admin('POST', `/admin/courses/${ids.courseId}/publish`)).status, 409);
    assert.equal(
      (await admin('DELETE', `/admin/courses/${ids.courseId}`)).status,
      409,
      'has curriculum',
    );
    const restored = await admin<AdminCourseDetail>(
      'POST',
      `/admin/courses/${ids.courseId}/restore`,
    );
    assert.equal(restored.body.data.status, 'DRAFT');

    const empty = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Empty draft',
    });
    expectStatus(await admin('DELETE', `/admin/courses/${empty.body.data.id}`), 200);
    assert.equal((await admin('GET', `/admin/courses/${empty.body.data.id}`)).status, 404);
  });
});

describe('course authorization', () => {
  it('students, faculty and anonymous callers cannot create, edit, assign, publish or unpublish', async () => {
    const ids = await createPublishableCourse(admin);
    const anonymous = apiAs(new TestClient(baseUrl), undefined);
    const studentClient = new TestClient(baseUrl);
    const student = apiAs(studentClient, await tokenFor(studentClient, 'STUDENT'));
    const facultyClient = new TestClient(baseUrl);
    const faculty = apiAs(facultyClient, await tokenFor(facultyClient, 'FACULTY'));

    const attempts: [string, string, unknown?][] = [
      ['GET', '/admin/courses'],
      ['GET', `/admin/courses/${ids.courseId}`],
      ['POST', '/admin/courses', { title: 'Hacked course' }],
      ['PATCH', `/admin/courses/${ids.courseId}`, { title: 'Hacked' }],
      ['DELETE', `/admin/courses/${ids.courseId}`],
      ['PUT', `/admin/courses/${ids.courseId}/instructors`, { instructors: [] }],
      ['POST', `/admin/courses/${ids.courseId}/publish`],
      ['POST', `/admin/courses/${ids.courseId}/unpublish`],
      ['GET', '/admin/faculty'],
    ];
    for (const [method, path, body] of attempts) {
      assert.equal(
        (await anonymous(method, path, body)).status,
        401,
        `anonymous ${method} ${path}`,
      );
      assert.equal((await student(method, path, body)).status, 403, `student ${method} ${path}`);
      assert.equal((await faculty(method, path, body)).status, 403, `faculty ${method} ${path}`);
    }
    const course = await prisma.course.findUniqueOrThrow({ where: { id: ids.courseId } });
    assert.equal(course.status, 'DRAFT');
    assert.match(course.title, /^Mathematics for Class 10/);
  });
});

describe('publication rules (unit)', () => {
  const complete = {
    description: 'A description',
    category: { name: 'School', isActive: true },
    class: null,
    stream: null,
    subject: null,
    instructors: [{ assignable: true }],
    lessons: [
      {
        id: 'l1',
        title: 'Notes',
        status: 'PUBLISHED',
        contentType: 'PDF' as const,
        body: null,
        resources: [{ type: 'PDF' as const }],
      },
    ],
  };

  it('accepts a complete course', () => {
    assert.deepEqual(evaluatePublication(complete), { eligible: true, issues: [] });
  });

  it('accepts class + subject instead of a category', () => {
    const check = evaluatePublication({
      ...complete,
      category: null,
      class: { name: 'Class 10', isActive: true },
      subject: { name: 'Maths', isActive: true },
    });
    assert.equal(check.eligible, true);
  });

  it('flags inactive relations, inactive-only faculty and draft-only curricula', () => {
    const check = evaluatePublication({
      ...complete,
      category: { name: 'Old', isActive: false },
      instructors: [{ assignable: false }],
      lessons: complete.lessons.map((lesson) => ({ ...lesson, status: 'DRAFT' })),
    });
    assert.deepEqual(
      check.issues.map((issue) => issue.code),
      ['CATEGORY_INACTIVE', 'INSTRUCTOR_REQUIRED', 'PUBLISHED_LESSON_REQUIRED'],
    );
  });

  it('requires instructions for quiz and assignment placeholders', () => {
    const check = evaluatePublication({
      ...complete,
      lessons: [
        {
          id: 'q',
          title: 'Quiz 1',
          status: 'PUBLISHED',
          contentType: 'QUIZ',
          body: '  ',
          resources: [],
        },
        {
          id: 'a',
          title: 'Task 1',
          status: 'PUBLISHED',
          contentType: 'ASSIGNMENT',
          body: 'Solve 1–10',
          resources: [],
        },
      ],
    });
    assert.deepEqual(
      check.issues.map((issue) => issue.path),
      [['curriculum', 'q']],
    );
  });
});
