/**
 * PHASE 06 exit criteria (end-to-end acceptance), through the real HTTP API and database only —
 * no direct database edits, mock data or workarounds. The faculty account is provisioned with the
 * operator CLI's service (`npm run auth:create-user -- --role FACULTY`), which is the approved way
 * to create staff accounts until the admin user-management screens exist (S-05).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type {
  AdminCourseDetail,
  ClassDto,
  CurriculumTreeDto,
  FacultyOptionDto,
  Paginated,
  PublicCourseDetail,
  PublicCourseSummary,
  SubjectDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { resetAuthState } from './support/auth.js';
import { apiAs, expectStatus, tokenFor, type Api } from './support/catalog.js';
import { provision } from './support/auth.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
  await resetAuthState();
});
after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});

describe('PHASE 06 acceptance workflow', () => {
  let admin: Api;
  let visitor: Api;
  let student: Api;
  const ids: Record<string, string> = {};

  it('0. an administrator signs in (anonymous and student callers are refused)', async () => {
    const client = new TestClient(baseUrl);
    admin = apiAs(client, await tokenFor(client, 'ADMIN'));
    visitor = apiAs(new TestClient(baseUrl), undefined);
    const studentClient = new TestClient(baseUrl);
    student = apiAs(studentClient, await tokenFor(studentClient, 'STUDENT'));
    await provision('FACULTY');
  });

  it('1. creates Class 10', async () => {
    const level = await admin<{ id: string }>('POST', '/admin/academic-levels', {
      name: 'Classes 6–10',
      board: 'CBSE',
    });
    expectStatus(level, 201);
    const klass = await admin<ClassDto>('POST', '/admin/classes', {
      academicLevelId: level.body.data.id,
      name: 'Class 10',
      gradeNumber: 10,
    });
    expectStatus(klass, 201);
    ids.classId = klass.body.data.id;
    assert.equal(
      (await student('POST', '/admin/classes', { academicLevelId: level.body.data.id, name: 'X' }))
        .status,
      403,
    );
  });

  it('2. creates Mathematics (linked to Class 10 through the course, per the approved model)', async () => {
    const subject = await admin<SubjectDto>('POST', '/admin/subjects', {
      name: 'Mathematics',
      code: '041',
    });
    expectStatus(subject, 201);
    ids.subjectId = subject.body.data.id;
    const category = await admin<{ id: string }>('POST', '/admin/course-categories', {
      name: 'School Education',
    });
    expectStatus(category, 201);
    ids.categoryId = category.body.data.id;
  });

  it('3. creates the Mathematics course with category, class, subject and faculty', async () => {
    const course = await admin<AdminCourseDetail>('POST', '/admin/courses', {
      title: 'Class 10 Mathematics',
      summary: 'CBSE Class 10 Mathematics, chapter by chapter.',
      description:
        'Real numbers, polynomials, quadratic equations and more, following the CBSE syllabus.',
      categoryId: ids.categoryId,
      classId: ids.classId,
      subjectId: ids.subjectId,
      durationMinutes: 3600,
      visibility: 'PUBLIC',
    });
    expectStatus(course, 201);
    ids.courseId = course.body.data.id;
    ids.slug = course.body.data.slug;
    assert.equal(course.body.data.status, 'DRAFT');

    const faculty = await admin<FacultyOptionDto[]>('GET', '/admin/faculty');
    const lecturer = faculty.body.data.find((option) => option.assignable);
    assert.ok(lecturer, 'a faculty member is available');
    const assigned = await admin<AdminCourseDetail>(
      'PUT',
      `/admin/courses/${ids.courseId}/instructors`,
      {
        instructors: [{ facultyProfileId: lecturer.facultyProfileId, isPrimary: true }],
      },
    );
    expectStatus(assigned, 200);
    assert.equal(assigned.body.data.instructors.length, 1);
  });

  it('4–6. creates a module, a chapter inside it and a lesson inside the chapter', async () => {
    const module = await admin<{ id: string }>('POST', `/admin/courses/${ids.courseId}/modules`, {
      title: 'Algebra',
    });
    expectStatus(module, 201);
    const chapter = await admin<{ id: string }>(
      'POST',
      `/admin/modules/${module.body.data.id}/chapters`,
      {
        title: 'Quadratic Equations',
      },
    );
    expectStatus(chapter, 201);
    const lesson = await admin<{ id: string }>(
      'POST',
      `/admin/chapters/${chapter.body.data.id}/lessons`,
      {
        title: 'Solving by factorisation',
        contentType: 'VIDEO',
        durationSeconds: 900,
      },
    );
    expectStatus(lesson, 201);
    ids.lessonId = lesson.body.data.id;
  });

  it('7. attaches a video and a PDF by reference', async () => {
    for (const [type, title, externalUrl] of [
      ['VIDEO', 'Lecture video', 'https://videos.example.com/class-10/quadratics-1'],
      ['PDF', 'Lecture notes', 'https://files.example.com/class-10/quadratics-1.pdf'],
    ] as const) {
      expectStatus(
        await admin('POST', `/admin/lessons/${ids.lessonId}/resources`, {
          title,
          type,
          location: { kind: 'external', externalUrl },
        }),
        201,
      );
    }
  });

  it('8. saves the curriculum and verifies the hierarchy', async () => {
    expectStatus(
      await admin('PATCH', `/admin/lessons/${ids.lessonId}`, { status: 'PUBLISHED' }),
      200,
    );
    const tree = await admin<CurriculumTreeDto>('GET', `/admin/courses/${ids.courseId}/curriculum`);
    expectStatus(tree, 200);
    const outline = tree.body.data.modules.map((m) => ({
      module: m.title,
      chapters: m.chapters.map((c) => ({
        chapter: c.title,
        lessons: c.lessons.map((l) => ({
          lesson: l.title,
          status: l.status,
          resources: l.resources.map((r) => r.type),
        })),
      })),
    }));
    assert.deepEqual(outline, [
      {
        module: 'Algebra',
        chapters: [
          {
            chapter: 'Quadratic Equations',
            lessons: [
              {
                lesson: 'Solving by factorisation',
                status: 'PUBLISHED',
                resources: ['VIDEO', 'PDF'],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('9. publishes once every requirement is met', async () => {
    const detail = await admin<AdminCourseDetail>('GET', `/admin/courses/${ids.courseId}`);
    assert.deepEqual(detail.body.data.publication, { eligible: true, issues: [] });
    assert.equal((await student('POST', `/admin/courses/${ids.courseId}/publish`)).status, 403);
    assert.equal((await visitor('POST', `/admin/courses/${ids.courseId}/publish`)).status, 401);
    const published = await admin<AdminCourseDetail>(
      'POST',
      `/admin/courses/${ids.courseId}/publish`,
      {
        expectedUpdatedAt: detail.body.data.updatedAt,
      },
    );
    expectStatus(published, 200);
    assert.equal(published.body.data.status, 'PUBLISHED');
  });

  it('10. the public catalogue shows the course', async () => {
    const list = await visitor<Paginated<PublicCourseSummary>>('GET', '/courses');
    assert.deepEqual(
      list.body.data.items.map((c) => c.title),
      ['Class 10 Mathematics'],
    );
    const detail = await visitor<PublicCourseDetail>('GET', `/courses/${ids.slug}`);
    expectStatus(detail, 200);
    assert.equal(detail.body.data.class?.name, 'Class 10');
    assert.equal(detail.body.data.subject?.name, 'Mathematics');
    assert.equal(detail.body.data.lessonCount, 1);
  });

  it('11. unpublishing removes it from the listing and the detail page', async () => {
    assert.equal((await student('POST', `/admin/courses/${ids.courseId}/unpublish`)).status, 403);
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/unpublish`), 200);
    const list = await visitor<Paginated<PublicCourseSummary>>('GET', '/courses');
    assert.equal(list.body.data.pagination.total, 0);
    assert.equal((await visitor('GET', `/courses/${ids.slug}`)).status, 404);
  });

  it('12. unauthorised callers cannot perform any step of the workflow', async () => {
    const steps: [string, string, unknown?][] = [
      ['POST', '/admin/academic-levels', { name: 'Level X' }],
      ['POST', '/admin/subjects', { name: 'Physics' }],
      ['POST', '/admin/courses', { title: 'Course X' }],
      ['PUT', `/admin/courses/${ids.courseId}/instructors`, { instructors: [] }],
      ['POST', `/admin/courses/${ids.courseId}/modules`, { title: 'Module X' }],
      ['PATCH', `/admin/lessons/${ids.lessonId}`, { title: 'Lesson X' }],
      ['POST', `/admin/courses/${ids.courseId}/publish`],
    ];
    for (const [method, path, body] of steps) {
      assert.equal((await visitor(method, path, body)).status, 401, `anonymous ${method} ${path}`);
      assert.equal((await student(method, path, body)).status, 403, `student ${method} ${path}`);
    }
  });
});
