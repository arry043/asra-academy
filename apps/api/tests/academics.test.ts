/**
 * PHASE 06 — academic structure: academic levels, classes, streams, subjects and course
 * categories through `/api/v1/admin/*` (real middleware, real database).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { resetAuthState } from './support/auth.js';
import { apiAs, expectStatus, tokenFor, type Api } from './support/catalog.js';
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

type Row = { id: string; slug: string; name: string; isActive: boolean };
type Issue = { path: string[]; message: string };

async function createLevel(name = 'Classes 6–10') {
  const response = await admin<Row>('POST', '/admin/academic-levels', { name, board: 'CBSE' });
  expectStatus(response, 201);
  return response.body.data;
}

describe('academic levels, classes and streams', () => {
  it('creates, reads, updates and lists classes within a level', async () => {
    const level = await createLevel();
    assert.equal(level.slug, 'classes-6-10');

    const created = await admin<Row & { gradeNumber: number; academicLevel: Row }>(
      'POST',
      '/admin/classes',
      {
        academicLevelId: level.id,
        name: 'Class 10',
        gradeNumber: 10,
      },
    );
    expectStatus(created, 201);
    assert.equal(created.body.data.slug, 'class-10');
    assert.equal(created.body.data.academicLevel.id, level.id);
    assert.equal(created.body.data.isActive, true);

    const updated = await admin<Row & { sortOrder: number }>(
      'PATCH',
      `/admin/classes/${created.body.data.id}`,
      {
        sortOrder: 5,
      },
    );
    expectStatus(updated, 200);
    assert.equal(updated.body.data.sortOrder, 5);
    assert.equal(updated.body.data.name, 'Class 10', 'PATCH must not reset omitted fields');
    assert.equal(updated.body.data.slug, 'class-10');

    await admin('POST', '/admin/classes', {
      academicLevelId: level.id,
      name: 'Class 9',
      gradeNumber: 9,
    });
    const list = await admin<{ items: Row[]; pagination: { total: number; pageCount: number } }>(
      'GET',
      `/admin/classes?academicLevelId=${level.id}&pageSize=1`,
    );
    expectStatus(list, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.pagination.total, 2);
    assert.equal(list.body.data.pagination.pageCount, 2);

    const search = await admin<{ items: Row[] }>('GET', '/admin/classes?q=class%2010');
    assert.deepEqual(
      search.body.data.items.map((item) => item.name),
      ['Class 10'],
    );
  });

  it('creates streams within a level', async () => {
    const level = await createLevel('Classes 11–12');
    const stream = await admin<Row>('POST', '/admin/streams', {
      academicLevelId: level.id,
      name: 'Science',
    });
    expectStatus(stream, 201);
    assert.equal(stream.body.data.slug, 'science');
  });

  it('rejects invalid input with field-level 422 errors', async () => {
    const level = await createLevel();
    const cases: [string, unknown, string][] = [
      ['/admin/classes', { academicLevelId: level.id, name: 'X' }, 'name'],
      ['/admin/classes', { academicLevelId: 'not-a-uuid', name: 'Class 8' }, 'academicLevelId'],
      [
        '/admin/classes',
        { academicLevelId: level.id, name: 'Class 8', gradeNumber: -1 },
        'gradeNumber',
      ],
      ['/admin/subjects', { name: 'Physics', slug: 'Not A Slug' }, 'slug'],
      ['/admin/subjects', { name: 'Physics', code: 'bad code!' }, 'code'],
    ];
    for (const [path, body, field] of cases) {
      const response = await admin<null>('POST', path, body);
      assert.equal(response.status, 422, `${path} ${JSON.stringify(body)}`);
      assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
      assert.ok(
        (response.body.error?.details as Issue[]).some((issue) => issue.path[0] === field),
        `expected an error on ${field}`,
      );
    }
  });

  it('rejects unknown keys (no mass assignment of ids, counts or timestamps)', async () => {
    const response = await admin('POST', '/admin/subjects', {
      name: 'Chemistry',
      id: '00000000-0000-4000-8000-000000000000',
      createdAt: '2020-01-01T00:00:00.000Z',
    });
    assert.equal(response.status, 422);
  });

  it('rejects a class for a missing or inactive academic level', async () => {
    const missing = await admin('POST', '/admin/classes', {
      academicLevelId: '00000000-0000-4000-8000-000000000000',
      name: 'Class 7',
    });
    assert.equal(missing.status, 422);

    const level = await createLevel('Retired level');
    await admin('PATCH', `/admin/academic-levels/${level.id}`, { isActive: false });
    const inactive = await admin('POST', '/admin/classes', {
      academicLevelId: level.id,
      name: 'Class 7',
    });
    assert.equal(inactive.status, 422);
  });

  it('handles duplicates: names per scope (case-insensitive), explicit slugs, generated slugs', async () => {
    const level = await createLevel();
    expectStatus(
      await admin('POST', '/admin/classes', { academicLevelId: level.id, name: 'Class 10' }),
      201,
    );

    const dupName = await admin<null>('POST', '/admin/classes', {
      academicLevelId: level.id,
      name: 'class 10',
    });
    assert.equal(dupName.status, 409);
    assert.deepEqual((dupName.body.error?.details as Issue[])[0]?.path, ['name']);

    // Same name in another level is fine; its generated slug gets a numeric suffix.
    const other = await createLevel('Other board');
    const second = await admin<Row>('POST', '/admin/classes', {
      academicLevelId: other.id,
      name: 'Class 10',
    });
    expectStatus(second, 201);
    assert.equal(second.body.data.slug, 'class-10-2');

    const dupSlug = await admin<null>('POST', '/admin/classes', {
      academicLevelId: other.id,
      name: 'Class Ten',
      slug: 'class-10',
    });
    assert.equal(dupSlug.status, 409);
    assert.deepEqual((dupSlug.body.error?.details as Issue[])[0]?.path, ['slug']);

    expectStatus(await admin('POST', '/admin/subjects', { name: 'Mathematics', code: '041' }), 201);
    assert.equal((await admin('POST', '/admin/subjects', { name: 'MATHEMATICS' })).status, 409);
    assert.equal(
      (await admin('POST', '/admin/subjects', { name: 'Maths', code: '041' })).status,
      409,
    );
    assert.equal(
      (await admin('POST', '/admin/course-categories', { name: 'Languages' })).status,
      201,
    );
    assert.equal(
      (await admin('POST', '/admin/course-categories', { name: 'languages' })).status,
      409,
    );
  });

  it('only deletes unused rows; referenced rows must be deactivated instead', async () => {
    const level = await createLevel();
    const klass = await admin<Row>('POST', '/admin/classes', {
      academicLevelId: level.id,
      name: 'Class 10',
    });
    const subject = await admin<Row>('POST', '/admin/subjects', { name: 'Mathematics' });
    const category = await admin<Row>('POST', '/admin/course-categories', { name: 'School' });
    expectStatus(
      await admin('POST', '/admin/courses', {
        title: 'Maths 10',
        classId: klass.body.data.id,
        subjectId: subject.body.data.id,
        categoryId: category.body.data.id,
      }),
      201,
    );

    for (const path of [
      `/admin/academic-levels/${level.id}`,
      `/admin/classes/${klass.body.data.id}`,
      `/admin/subjects/${subject.body.data.id}`,
      `/admin/course-categories/${category.body.data.id}`,
    ]) {
      const response = await admin('DELETE', path);
      assert.equal(response.status, 409, path);
      assert.equal(response.body.error?.code, 'CONFLICT');
    }
    assert.equal(await prisma.class.count({ where: { id: klass.body.data.id } }), 1);

    // Deactivation is the safe alternative while only DRAFT courses use the row.
    const deactivated = await admin<Row>('PATCH', `/admin/subjects/${subject.body.data.id}`, {
      isActive: false,
    });
    expectStatus(deactivated, 200);
    assert.equal(deactivated.body.data.isActive, false);

    const unused = await admin<Row>('POST', '/admin/subjects', { name: 'Unused subject' });
    expectStatus(await admin('DELETE', `/admin/subjects/${unused.body.data.id}`), 200);
    assert.equal((await admin('GET', `/admin/subjects/${unused.body.data.id}`)).status, 404);
  });

  it('returns 404 for unknown ids and 422 for malformed ids', async () => {
    assert.equal(
      (await admin('GET', '/admin/classes/00000000-0000-4000-8000-000000000000')).status,
      404,
    );
    assert.equal(
      (
        await admin('PATCH', '/admin/streams/00000000-0000-4000-8000-000000000000', {
          name: 'Arts',
        })
      ).status,
      404,
    );
    assert.equal((await admin('GET', '/admin/classes/123')).status, 422);
  });
});

describe('academic structure authorization', () => {
  it('requires authentication and the academic_structure.manage / courses.manage permissions', async () => {
    const level = await createLevel();
    const anonymous = apiAs(new TestClient(baseUrl), undefined);
    const studentClient = new TestClient(baseUrl);
    const student = apiAs(studentClient, await tokenFor(studentClient, 'STUDENT'));
    const facultyClient = new TestClient(baseUrl);
    const faculty = apiAs(facultyClient, await tokenFor(facultyClient, 'FACULTY'));

    const attempts: [string, string, unknown?][] = [
      ['GET', '/admin/academic-levels'],
      ['POST', '/admin/academic-levels', { name: 'Hacked level' }],
      ['PATCH', `/admin/academic-levels/${level.id}`, { name: 'Hacked' }],
      ['DELETE', `/admin/academic-levels/${level.id}`],
      ['POST', '/admin/classes', { academicLevelId: level.id, name: 'Class 6' }],
      ['POST', '/admin/streams', { academicLevelId: level.id, name: 'Arts' }],
      ['POST', '/admin/subjects', { name: 'History' }],
      ['POST', '/admin/course-categories', { name: 'Hacked category' }],
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
    const unchanged = await prisma.academicLevel.findUniqueOrThrow({ where: { id: level.id } });
    assert.equal(unchanged.name, 'Classes 6–10');
    assert.equal(await prisma.subject.count(), 0);
  });

  it('allows SUPER_ADMIN as well as ADMIN', async () => {
    const client = new TestClient(baseUrl);
    const superAdmin = apiAs(client, await tokenFor(client, 'SUPER_ADMIN'));
    expectStatus(await superAdmin('POST', '/admin/subjects', { name: 'Biology' }), 201);
  });

  it('marks admin responses as not cacheable', async () => {
    const response = await admin('GET', '/admin/subjects');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});
