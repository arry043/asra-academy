/**
 * PHASE 06 — curriculum and lesson content: Course → Module → Chapter → Lesson → Resource
 * through `/api/v1/admin/*` (real middleware, real database).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { CurriculumTreeDto, LessonDto, ModuleDto, ResourceDto } from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { resetAuthState } from './support/auth.js';
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

async function newCourse(title = 'Curriculum course') {
  const response = await admin<{ id: string }>('POST', '/admin/courses', { title });
  expectStatus(response, 201);
  return response.body.data.id;
}

async function create<T = { id: string }>(path: string, body: unknown): Promise<T> {
  const response = await admin<T>('POST', path, body);
  expectStatus(response, 201);
  return response.body.data;
}

const VIDEO_URL = 'https://videos.example.com/lesson-1';

describe('curriculum hierarchy', () => {
  it('builds module → chapter → lesson → resource and returns the ordered tree', async () => {
    const courseId = await newCourse();
    const m1 = await create(`/admin/courses/${courseId}/modules`, { title: 'Module A' });
    const m2 = await create(`/admin/courses/${courseId}/modules`, { title: 'Module B' });
    const chapter = await create(`/admin/modules/${m1.id}/chapters`, { title: 'Chapter 1' });
    const lesson = await create<LessonDto>(`/admin/chapters/${chapter.id}/lessons`, {
      title: 'Lesson 1',
      contentType: 'VIDEO',
      durationSeconds: 600,
    });
    assert.equal(lesson.status, 'DRAFT');
    assert.equal(lesson.publishedAt, null);
    await create(`/admin/lessons/${lesson.id}/resources`, {
      title: 'Video',
      type: 'VIDEO',
      location: { kind: 'external', externalUrl: VIDEO_URL },
    });

    const tree = await admin<CurriculumTreeDto>('GET', `/admin/courses/${courseId}/curriculum`);
    expectStatus(tree, 200);
    assert.deepEqual(
      tree.body.data.modules.map((m) => [m.title, m.position]),
      [
        ['Module A', 0],
        ['Module B', 1],
      ],
    );
    const firstLesson = tree.body.data.modules[0]?.chapters[0]?.lessons[0];
    assert.equal(firstLesson?.title, 'Lesson 1');
    assert.deepEqual(firstLesson?.resources[0]?.location, {
      kind: 'external',
      externalUrl: VIDEO_URL,
    });
    assert.equal(tree.body.data.modules[1]?.id, m2.id);

    // Collection endpoints return the same ordering.
    const lessons = await admin<LessonDto[]>('GET', `/admin/chapters/${chapter.id}/lessons`);
    assert.deepEqual(
      lessons.body.data.map((l) => l.id),
      [lesson.id],
    );
    const single = await admin<LessonDto>('GET', `/admin/lessons/${lesson.id}`);
    assert.equal(single.body.data.resources.length, 1);
  });

  it('reorders siblings and rejects lists that are not exactly the current children', async () => {
    const courseId = await newCourse();
    const ids = [];
    for (const title of ['One', 'Two', 'Three']) {
      ids.push((await create(`/admin/courses/${courseId}/modules`, { title })).id);
    }
    const reordered = await admin<ModuleDto[]>('PUT', `/admin/courses/${courseId}/modules/order`, {
      orderedIds: [ids[2], ids[0], ids[1]],
    });
    expectStatus(reordered, 200);
    assert.deepEqual(
      reordered.body.data.map((m) => [m.title, m.position]),
      [
        ['Three', 0],
        ['One', 1],
        ['Two', 2],
      ],
    );

    const missing = await admin('PUT', `/admin/courses/${courseId}/modules/order`, {
      orderedIds: [ids[0], ids[1]],
    });
    assert.equal(missing.status, 422);
    const duplicated = await admin('PUT', `/admin/courses/${courseId}/modules/order`, {
      orderedIds: [ids[0], ids[0], ids[1]],
    });
    assert.equal(duplicated.status, 422);

    // New items are appended after the current last position.
    const fourth = await create<ModuleDto>(`/admin/courses/${courseId}/modules`, { title: 'Four' });
    assert.equal(fourth.position, 3);
  });

  it('prevents cross-course and cross-chapter manipulation', async () => {
    const courseA = await newCourse('Course A');
    const courseB = await newCourse('Course B');
    const moduleA = await create(`/admin/courses/${courseA}/modules`, { title: 'A1' });
    const moduleB = await create(`/admin/courses/${courseB}/modules`, { title: 'B1' });

    // Course A's order cannot include course B's module.
    const foreign = await admin('PUT', `/admin/courses/${courseA}/modules/order`, {
      orderedIds: [moduleB.id],
    });
    assert.equal(foreign.status, 422);
    const unchanged = await prisma.module.findUniqueOrThrow({ where: { id: moduleB.id } });
    assert.equal(unchanged.courseId, courseB);

    // Lessons are reordered within their own chapter only.
    const chapterA = await create(`/admin/modules/${moduleA.id}/chapters`, { title: 'Ch A' });
    const chapterB = await create(`/admin/modules/${moduleB.id}/chapters`, { title: 'Ch B' });
    const lessonB = await create(`/admin/chapters/${chapterB.id}/lessons`, {
      title: 'L',
      contentType: 'TEXT',
    });
    const crossLesson = await admin('PUT', `/admin/chapters/${chapterA.id}/lessons/order`, {
      orderedIds: [lessonB.id],
    });
    assert.equal(crossLesson.status, 422);

    // A body cannot re-parent an item (unknown keys are rejected).
    const reparent = await admin('PATCH', `/admin/chapters/${chapterB.id}`, {
      moduleId: moduleA.id,
    });
    assert.equal(reparent.status, 422);
    const lessonMove = await admin('PATCH', `/admin/lessons/${lessonB.id}`, {
      chapterId: chapterA.id,
    });
    assert.equal(lessonMove.status, 422);
    assert.equal(
      (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonB.id } })).chapterId,
      chapterB.id,
    );
  });

  it('rejects mismatched or missing parents with 404', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    assert.equal(
      (await admin('POST', `/admin/courses/${missing}/modules`, { title: 'M' })).status,
      404,
    );
    assert.equal(
      (await admin('POST', `/admin/modules/${missing}/chapters`, { title: 'C' })).status,
      404,
    );
    assert.equal(
      (
        await admin('POST', `/admin/chapters/${missing}/lessons`, {
          title: 'L',
          contentType: 'TEXT',
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await admin('POST', `/admin/lessons/${missing}/resources`, {
          title: 'R',
          type: 'PDF',
          location: { kind: 'external', externalUrl: 'https://files.example.com/a.pdf' },
        })
      ).status,
      404,
    );
    assert.equal((await admin('GET', `/admin/courses/${missing}/curriculum`)).status, 404);
    assert.equal((await admin('PATCH', `/admin/resources/${missing}`, { title: 'X' })).status, 404);
  });

  it('never deletes structure with children by accident', async () => {
    const courseId = await newCourse();
    const module = await create(`/admin/courses/${courseId}/modules`, { title: 'M' });
    const chapter = await create(`/admin/modules/${module.id}/chapters`, { title: 'C' });
    const lesson = await create(`/admin/chapters/${chapter.id}/lessons`, {
      title: 'L',
      contentType: 'TEXT',
    });

    assert.equal((await admin('DELETE', `/admin/modules/${module.id}`)).status, 409);
    assert.equal((await admin('DELETE', `/admin/chapters/${chapter.id}`)).status, 409);
    expectStatus(await admin('DELETE', `/admin/lessons/${lesson.id}`), 200);
    expectStatus(await admin('DELETE', `/admin/chapters/${chapter.id}`), 200);
    expectStatus(await admin('DELETE', `/admin/modules/${module.id}`), 200);
    assert.equal(await prisma.module.count({ where: { courseId } }), 0);
  });
});

describe('lesson content types and resources', () => {
  async function lessonFor(contentType: string, extra: Record<string, unknown> = {}) {
    const courseId = await newCourse(`Content ${contentType}`);
    const module = await create(`/admin/courses/${courseId}/modules`, { title: 'M' });
    const chapter = await create(`/admin/modules/${module.id}/chapters`, { title: 'C' });
    return create<LessonDto>(`/admin/chapters/${chapter.id}/lessons`, {
      title: contentType,
      contentType,
      ...extra,
    });
  }

  it('supports video, PDF, document, external link, quiz and assignment lessons', async () => {
    const cases: [string, string, string][] = [
      ['VIDEO', 'VIDEO', 'https://www.youtube.com/watch?v=abc123'],
      ['PDF', 'PDF', 'https://files.example.com/notes.pdf'],
      ['DOCUMENT', 'DOCUMENT', 'https://docs.example.com/worksheet'],
      ['LINK', 'EXTERNAL_LINK', 'https://en.wikipedia.org/wiki/Quadratic_equation'],
    ];
    for (const [contentType, type, externalUrl] of cases) {
      const lesson = await lessonFor(contentType);
      const resource = await create<ResourceDto>(`/admin/lessons/${lesson.id}/resources`, {
        title: `${contentType} resource`,
        type,
        location: { kind: 'external', externalUrl },
        mimeType: contentType === 'PDF' ? 'application/pdf' : undefined,
      });
      assert.equal(resource.type, type);
      assert.equal(resource.position, 0);
    }

    const quiz = await lessonFor('QUIZ', { body: 'Answer the 10 questions in the worksheet.' });
    assert.equal(quiz.contentType, 'QUIZ');
    const assignment = await lessonFor('ASSIGNMENT', {
      body: 'Solve exercise 4.2 and submit to your teacher.',
    });
    assert.equal(assignment.contentType, 'ASSIGNMENT');
    // Assignments may carry a resource (e.g. the question sheet).
    await create(`/admin/lessons/${assignment.id}/resources`, {
      title: 'Question sheet',
      type: 'PDF',
      location: { kind: 'external', externalUrl: 'https://files.example.com/ex-4-2.pdf' },
    });

    const updated = await admin<LessonDto>('PATCH', `/admin/lessons/${quiz.id}`, {
      title: 'Quiz — updated',
      status: 'PUBLISHED',
    });
    expectStatus(updated, 200);
    assert.equal(updated.body.data.status, 'PUBLISHED');
    assert.ok(updated.body.data.publishedAt);
    const back = await admin<LessonDto>('PATCH', `/admin/lessons/${quiz.id}`, { status: 'DRAFT' });
    assert.equal(back.body.data.publishedAt, null);
    assert.equal(
      (
        await admin('POST', `/admin/chapters/${quiz.chapterId}/lessons`, {
          title: 'X',
          contentType: 'SCORM',
        })
      ).status,
      422,
    );
  });

  it('validates external URLs and refuses unsafe schemes and hosts', async () => {
    const lesson = await lessonFor('LINK');
    for (const externalUrl of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://example.com/plain-http',
      'https://localhost/admin',
      'https://127.0.0.1/x',
      'https://user:secret@example.com/x',
      'not a url',
    ]) {
      const response = await admin('POST', `/admin/lessons/${lesson.id}/resources`, {
        title: 'Bad link',
        type: 'EXTERNAL_LINK',
        location: { kind: 'external', externalUrl },
      });
      assert.equal(response.status, 422, externalUrl);
    }
    assert.equal(await prisma.resource.count({ where: { lessonId: lesson.id } }), 0);
  });

  it('refuses stored-file references while no storage provider is configured', async () => {
    const lesson = await lessonFor('PDF');
    const response = await admin('POST', `/admin/lessons/${lesson.id}/resources`, {
      title: 'Uploaded notes',
      type: 'PDF',
      location: { kind: 'storage', storageProvider: 's3', storageKey: 'courses/notes.pdf' },
    });
    assert.equal(response.status, 422);
    assert.match(response.body.message, /storage is not configured/i);
  });

  it('keeps type and location consistent on update', async () => {
    const lesson = await lessonFor('VIDEO');
    const resource = await create<ResourceDto>(`/admin/lessons/${lesson.id}/resources`, {
      title: 'Video',
      type: 'VIDEO',
      location: { kind: 'external', externalUrl: VIDEO_URL },
    });
    const updated = await admin<ResourceDto>('PATCH', `/admin/resources/${resource.id}`, {
      title: 'Lecture (HD)',
      location: { kind: 'external', externalUrl: 'https://videos.example.com/lesson-1-hd' },
    });
    expectStatus(updated, 200);
    assert.equal(updated.body.data.title, 'Lecture (HD)');
    assert.equal(updated.body.data.type, 'VIDEO');

    const second = await create<ResourceDto>(`/admin/lessons/${lesson.id}/resources`, {
      title: 'Slides',
      type: 'PRESENTATION',
      location: { kind: 'external', externalUrl: 'https://slides.example.com/deck' },
    });
    const order = await admin<ResourceDto[]>('PUT', `/admin/lessons/${lesson.id}/resources/order`, {
      orderedIds: [second.id, resource.id],
    });
    assert.deepEqual(
      order.body.data.map((r) => r.title),
      ['Slides', 'Lecture (HD)'],
    );
  });
});

describe('curriculum of a published course', () => {
  it('rolls back changes that would leave the live course without content', async () => {
    const ids = await createPublishableCourse(admin);
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);

    assert.equal((await admin('DELETE', `/admin/resources/${ids.resourceId}`)).status, 422);
    assert.equal((await admin('DELETE', `/admin/lessons/${ids.lessonId}`)).status, 422);
    assert.equal(
      (await admin('PATCH', `/admin/lessons/${ids.lessonId}`, { status: 'DRAFT' })).status,
      422,
    );
    assert.equal(await prisma.resource.count({ where: { id: ids.resourceId } }), 1);

    // Adding a draft lesson to a live course is fine; publishing it without content is not.
    const draft = await create<LessonDto>(`/admin/chapters/${ids.chapterId}/lessons`, {
      title: 'Coming soon',
      contentType: 'PDF',
    });
    assert.equal(
      (await admin('PATCH', `/admin/lessons/${draft.id}`, { status: 'PUBLISHED' })).status,
      422,
    );
  });
});

describe('curriculum authorization', () => {
  it('students, faculty and anonymous callers cannot read or change curriculum', async () => {
    const ids = await createPublishableCourse(admin);
    const anonymous = apiAs(new TestClient(baseUrl), undefined);
    const studentClient = new TestClient(baseUrl);
    const student = apiAs(studentClient, await tokenFor(studentClient, 'STUDENT'));
    const facultyClient = new TestClient(baseUrl);
    const faculty = apiAs(facultyClient, await tokenFor(facultyClient, 'FACULTY'));

    const attempts: [string, string, unknown?][] = [
      ['GET', `/admin/courses/${ids.courseId}/curriculum`],
      ['POST', `/admin/courses/${ids.courseId}/modules`, { title: 'Hacked' }],
      ['PATCH', `/admin/modules/${ids.moduleId}`, { title: 'Hacked' }],
      ['POST', `/admin/modules/${ids.moduleId}/chapters`, { title: 'Hacked' }],
      ['PATCH', `/admin/chapters/${ids.chapterId}`, { title: 'Hacked' }],
      [
        'POST',
        `/admin/chapters/${ids.chapterId}/lessons`,
        { title: 'Hacked', contentType: 'TEXT' },
      ],
      ['PATCH', `/admin/lessons/${ids.lessonId}`, { title: 'Hacked' }],
      ['DELETE', `/admin/lessons/${ids.lessonId}`],
      [
        'POST',
        `/admin/lessons/${ids.lessonId}/resources`,
        { title: 'x', type: 'VIDEO', location: { kind: 'external', externalUrl: VIDEO_URL } },
      ],
      ['DELETE', `/admin/resources/${ids.resourceId}`],
      ['PUT', `/admin/courses/${ids.courseId}/modules/order`, { orderedIds: [ids.moduleId] }],
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
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: ids.lessonId } });
    assert.equal(lesson.title, 'Introduction to quadratics');
    assert.equal(await prisma.resource.count({ where: { lessonId: ids.lessonId } }), 1);
  });
});
