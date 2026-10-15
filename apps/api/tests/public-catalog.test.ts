/**
 * PHASE 06 — public catalogue: `/api/v1/courses` exposes only PUBLISHED courses, with the
 * documented visibility rules enforced by the backend.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { Paginated, PublicCourseDetail, PublicCourseSummary } from '@asra/types';
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
let visitor: Api;

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
  visitor = apiAs(new TestClient(baseUrl), undefined);
});

const listSlugs = async (query = '') =>
  (await visitor<Paginated<PublicCourseSummary>>('GET', `/courses${query}`)).body.data.items.map(
    (c) => c.slug,
  );

describe('public course visibility', () => {
  it('never lists or reveals draft courses, even by slug', async () => {
    const ids = await createPublishableCourse(admin);
    assert.deepEqual(await listSlugs(), []);
    const detail = await visitor('GET', `/courses/${ids.slug}`);
    assert.equal(detail.status, 404);
    assert.equal(detail.body.error?.code, 'NOT_FOUND');
  });

  it('lists a published PUBLIC course and removes it again when unpublished', async () => {
    const ids = await createPublishableCourse(admin);
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);

    assert.deepEqual(await listSlugs(), [ids.slug]);
    const detail = await visitor<PublicCourseDetail>('GET', `/courses/${ids.slug}`);
    expectStatus(detail, 200);
    assert.equal(detail.body.data.visibility, 'PUBLIC');
    assert.equal(detail.body.data.lessonCount, 1);

    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/unpublish`), 200);
    assert.deepEqual(await listSlugs(), []);
    assert.equal((await visitor('GET', `/courses/${ids.slug}`)).status, 404);
  });

  it('UNLISTED: reachable by slug but not listed; PRIVATE: never public', async () => {
    const unlisted = await createPublishableCourse(admin, { visibility: 'UNLISTED' });
    const hidden = await createPublishableCourse(admin, { visibility: 'PRIVATE' });
    for (const ids of [unlisted, hidden]) {
      expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);
    }
    assert.deepEqual(await listSlugs(), []);
    const detail = await visitor<PublicCourseDetail>('GET', `/courses/${unlisted.slug}`);
    expectStatus(detail, 200);
    assert.equal(detail.body.data.visibility, 'UNLISTED');
    assert.equal((await visitor('GET', `/courses/${hidden.slug}`)).status, 404);

    // Visibility changes take effect immediately.
    await admin('PATCH', `/admin/courses/${hidden.courseId}`, { visibility: 'PUBLIC' });
    assert.deepEqual(await listSlugs(), [hidden.slug]);
  });

  it('archived courses are not public', async () => {
    const ids = await createPublishableCourse(admin);
    await admin('POST', `/admin/courses/${ids.courseId}/archive`);
    assert.equal((await visitor('GET', `/courses/${ids.slug}`)).status, 404);
  });

  it('exposes only the public outline: no draft lessons, resource URLs, bodies, prices or private faculty', async () => {
    const ids = await createPublishableCourse(admin, { priceMinor: 99900, currency: 'INR' });
    await admin('POST', `/admin/chapters/${ids.chapterId}/lessons`, {
      title: 'Unfinished draft lesson',
      contentType: 'TEXT',
      body: 'Secret draft notes',
    });
    expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);

    const detail = await visitor<PublicCourseDetail>('GET', `/courses/${ids.slug}`);
    expectStatus(detail, 200);
    assert.deepEqual(
      detail.body.data.curriculum.map((m) => [
        m.title,
        m.chapters.map((c) => c.lessons.map((l) => l.title)),
      ]),
      [['Algebra', [['Introduction to quadratics']]]],
    );
    for (const secret of [
      'videos.example.com',
      'Unfinished draft lesson',
      'Secret draft notes',
      '99900',
      'priceMinor',
      ids.courseId,
    ]) {
      assert.ok(!detail.text.includes(secret), `public detail leaked "${secret}"`);
    }
    // Faculty profiles are private until an admin makes them public (C-02).
    assert.deepEqual(detail.body.data.instructors, []);
    await prisma.facultyProfile.update({
      where: { id: ids.facultyProfileId },
      data: { isPublic: true, designation: 'Mathematics Faculty' },
    });
    const withFaculty = await visitor<PublicCourseDetail>('GET', `/courses/${ids.slug}`);
    assert.deepEqual(withFaculty.body.data.instructors, [
      { fullName: 'Test FACULTY', designation: 'Mathematics Faculty' },
    ]);
    assert.ok(!withFaculty.text.includes('@example.test'), 'no faculty email');
  });

  it('filters by category, class and subject slug, searches, and paginates', async () => {
    const first = await createPublishableCourse(admin);
    const second = await createPublishableCourse(admin);
    for (const ids of [first, second]) {
      expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);
    }
    const category = await prisma.courseCategory.findUniqueOrThrow({
      where: { id: first.categoryId },
    });
    const klass = await prisma.class.findUniqueOrThrow({ where: { id: second.classId } });
    assert.deepEqual(await listSlugs(`?category=${category.slug}`), [first.slug]);
    assert.deepEqual(await listSlugs(`?class=${klass.slug}`), [second.slug]);
    assert.equal((await listSlugs('?q=mathematics')).length, 2);

    const page = await visitor<Paginated<PublicCourseSummary>>('GET', '/courses?pageSize=1&page=2');
    assert.equal(page.body.data.items.length, 1);
    assert.equal(page.body.data.pagination.total, 2);
  });

  it('validates the slug and query parameters', async () => {
    assert.equal((await visitor('GET', '/courses/Not%20A%20Slug')).status, 422);
    assert.equal((await visitor('GET', '/courses?pageSize=500')).status, 422);
    assert.equal((await visitor('GET', '/courses?status=DRAFT')).status, 422, 'no status override');
    assert.equal((await visitor('GET', '/courses/no-such-course')).status, 404);
  });
});
