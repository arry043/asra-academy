import type { UserRole } from '@asra/types';
import { prisma } from '../../src/database/prisma.js';
import { login, provision, registerVerifiedStudent } from './auth.js';
import { uniqueSuffix } from './fixtures.js';
import type { TestClient, TestResponse } from './http.js';

/** Signed-in callers for the PHASE 06 suites (fresh accounts per call). */
export async function tokenFor(client: TestClient, role: UserRole): Promise<string> {
  if (role === 'STUDENT')
    return (await login(client, await registerVerifiedStudent(client))).accessToken;
  return (await login(client, (await provision(role)).email)).accessToken;
}

/** A FACULTY account and its FacultyProfile id (what CourseInstructor references). */
export async function createFaculty(fullName?: string) {
  const user = await provision('FACULTY');
  if (fullName) await prisma.user.update({ where: { id: user.id }, data: { fullName } });
  const profile = await prisma.facultyProfile.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, facultyProfileId: profile.id };
}

/** Thin wrapper: `api('POST', '/admin/classes', body)` with the bearer token applied. */
export function apiAs(client: TestClient, token: string | undefined) {
  return <T = Record<string, unknown>>(method: string, path: string, body?: unknown) =>
    client.request<T>(method, path, { token, ...(body === undefined ? {} : { body }) });
}

export type Api = ReturnType<typeof apiAs>;

export function expectStatus(response: TestResponse, status: number): void {
  if (response.status !== status) {
    throw new Error(`Expected HTTP ${status}, got ${response.status}: ${response.text}`);
  }
}

/** Creates level → class → subject (+ category) through the API and returns their ids. */
export async function createAcademicBasics(api: Api) {
  const s = uniqueSuffix();
  const level = await api<{ id: string }>('POST', '/admin/academic-levels', {
    name: `Classes 6–10 ${s}`,
    board: 'CBSE',
  });
  expectStatus(level, 201);
  const klass = await api<{ id: string }>('POST', '/admin/classes', {
    academicLevelId: level.body.data.id,
    name: `Class 10 ${s}`,
    gradeNumber: 10,
  });
  expectStatus(klass, 201);
  const subject = await api<{ id: string }>('POST', '/admin/subjects', {
    name: `Mathematics ${s}`,
  });
  expectStatus(subject, 201);
  const category = await api<{ id: string }>('POST', '/admin/course-categories', {
    name: `School Education ${s}`,
  });
  expectStatus(category, 201);
  return {
    levelId: level.body.data.id,
    classId: klass.body.data.id,
    subjectId: subject.body.data.id,
    categoryId: category.body.data.id,
  };
}

/**
 * A course that satisfies every publication rule: description, class + subject + category, an
 * active faculty member, and one published VIDEO lesson with a video link. Returns ids.
 */
export async function createPublishableCourse(api: Api, overrides: Record<string, unknown> = {}) {
  const basics = await createAcademicBasics(api);
  const { facultyProfileId } = await createFaculty();
  const course = await api<{ id: string; slug: string; updatedAt: string }>(
    'POST',
    '/admin/courses',
    {
      title: `Mathematics for Class 10 ${uniqueSuffix()}`,
      description: 'Algebra, geometry and statistics for Class 10.',
      categoryId: basics.categoryId,
      classId: basics.classId,
      subjectId: basics.subjectId,
      ...overrides,
    },
  );
  expectStatus(course, 201);
  const courseId = course.body.data.id;
  expectStatus(
    await api('PUT', `/admin/courses/${courseId}/instructors`, {
      instructors: [{ facultyProfileId, isPrimary: true }],
    }),
    200,
  );
  const module = await api<{ id: string }>('POST', `/admin/courses/${courseId}/modules`, {
    title: 'Algebra',
  });
  expectStatus(module, 201);
  const chapter = await api<{ id: string }>(
    'POST',
    `/admin/modules/${module.body.data.id}/chapters`,
    {
      title: 'Quadratic equations',
    },
  );
  expectStatus(chapter, 201);
  const lesson = await api<{ id: string }>(
    'POST',
    `/admin/chapters/${chapter.body.data.id}/lessons`,
    {
      title: 'Introduction to quadratics',
      contentType: 'VIDEO',
      status: 'PUBLISHED',
    },
  );
  expectStatus(lesson, 201);
  const resource = await api<{ id: string }>(
    'POST',
    `/admin/lessons/${lesson.body.data.id}/resources`,
    {
      title: 'Lecture video',
      type: 'VIDEO',
      location: { kind: 'external', externalUrl: 'https://videos.example.com/quadratics-1' },
    },
  );
  expectStatus(resource, 201);
  return {
    ...basics,
    facultyProfileId,
    courseId,
    slug: course.body.data.slug,
    moduleId: module.body.data.id,
    chapterId: chapter.body.data.id,
    lessonId: lesson.body.data.id,
    resourceId: resource.body.data.id,
  };
}
