import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { toAppError } from '../src/database/errors.js';
import {
  createPrismaClient,
  disconnectPrisma,
  pingDatabase,
  prisma,
} from '../src/database/prisma.js';
import { seedAccessControl } from '../src/database/seed/access-control.seed.js';
import { cleanDomainTables, createCourseTree, uniqueSuffix } from './support/fixtures.js';

/** Asserts that `promise` rejects with a database error that maps to the given API error code. */
async function rejectsAs(promise: Promise<unknown>, apiCode: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    const mapped = toAppError(error);
    assert.ok(mapped, `expected a mapped database error, got: ${String(error)}`);
    assert.equal(mapped.code, apiCode);
    return true;
  });
}

async function createUser(overrides: { email?: string } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${uniqueSuffix()}@example.test`,
      fullName: 'Test User',
    },
  });
}

after(() => disconnectPrisma());

describe('database connectivity', () => {
  it('connects and answers a query', async () => {
    await pingDatabase();
  });

  it('reports an unreachable database as SERVICE_UNAVAILABLE', async () => {
    const unreachable = createPrismaClient('postgresql://nobody:nothing@127.0.0.1:1/none');
    try {
      await rejectsAs(pingDatabase(unreachable), 'SERVICE_UNAVAILABLE'); // raw query → P2010
      await rejectsAs(unreachable.user.count(), 'SERVICE_UNAVAILABLE'); // model query → P1001
    } finally {
      await disconnectPrisma(unreachable);
    }
  });
});

describe('constraints and relationships', () => {
  before(async () => {
    await cleanDomainTables();
    await seedAccessControl(prisma);
  });
  afterEach(() => cleanDomainTables());

  it('generates UUID primary keys in PostgreSQL', async () => {
    const user = await createUser();
    assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects duplicate emails (unique) → CONFLICT', async () => {
    const email = `dup-${uniqueSuffix()}@example.test`;
    await createUser({ email });
    await rejectsAs(createUser({ email }), 'CONFLICT');
  });

  it('rejects non-normalised emails (CHECK) → VALIDATION_ERROR', async () => {
    await rejectsAs(
      createUser({ email: `Mixed-${uniqueSuffix()}@Example.test` }),
      'VALIDATION_ERROR',
    );
    await rejectsAs(
      createUser({ email: ` padded-${uniqueSuffix()}@example.test` }),
      'VALIDATION_ERROR',
    );
  });

  it('assigns multiple roles to one user, but each role only once', async () => {
    const user = await createUser();
    const [admin, faculty] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { key: 'FACULTY' } }),
    ]);
    await prisma.userRole.createMany({
      data: [
        { userId: user.id, roleId: admin.id },
        { userId: user.id, roleId: faculty.id },
      ],
    });
    assert.equal(await prisma.userRole.count({ where: { userId: user.id } }), 2);
    await rejectsAs(
      prisma.userRole.create({ data: { userId: user.id, roleId: admin.id } }),
      'CONFLICT',
    );
  });

  it('prevents deleting a role that is still assigned (RESTRICT)', async () => {
    const user = await createUser();
    const role = await prisma.role.create({
      data: { key: `TEMP_${uniqueSuffix().toUpperCase()}`, name: 'Temp' },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    await rejectsAs(prisma.role.delete({ where: { id: role.id } }), 'CONFLICT');

    await prisma.userRole.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  it('allows at most one student profile per user', async () => {
    const user = await createUser();
    await prisma.studentProfile.create({ data: { userId: user.id } });
    await rejectsAs(prisma.studentProfile.create({ data: { userId: user.id } }), 'CONFLICT');
  });

  it('deleting a user cascades to roles and profiles', async () => {
    const user = await createUser();
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'STUDENT' } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.studentProfile.create({ data: { userId: user.id } });

    await prisma.user.delete({ where: { id: user.id } });

    assert.equal(await prisma.studentProfile.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.userRole.count({ where: { userId: user.id } }), 0);
  });

  it('protects in-use academic structure from deletion (RESTRICT)', async () => {
    const s = uniqueSuffix();
    const level = await prisma.academicLevel.create({
      data: { name: `Level ${s}`, slug: `level-${s}` },
    });
    const cls = await prisma.class.create({
      data: { academicLevelId: level.id, name: 'Class 10', slug: `class-10-${s}`, gradeNumber: 10 },
    });
    const subject = await prisma.subject.create({
      data: { name: `Maths ${s}`, slug: `maths-${s}` },
    });
    await prisma.course.create({
      data: { title: 'Maths 10', slug: `maths-10-${s}`, classId: cls.id, subjectId: subject.id },
    });

    await rejectsAs(prisma.academicLevel.delete({ where: { id: level.id } }), 'CONFLICT');
    await rejectsAs(prisma.class.delete({ where: { id: cls.id } }), 'CONFLICT');
    await rejectsAs(prisma.subject.delete({ where: { id: subject.id } }), 'CONFLICT');
  });

  it('rejects duplicate class names within one academic level', async () => {
    const s = uniqueSuffix();
    const level = await prisma.academicLevel.create({
      data: { name: `Level ${s}`, slug: `level-${s}` },
    });
    await prisma.class.create({
      data: { academicLevelId: level.id, name: 'Class 6', slug: `c6-${s}` },
    });
    await rejectsAs(
      prisma.class.create({
        data: { academicLevelId: level.id, name: 'Class 6', slug: `c6b-${s}` },
      }),
      'CONFLICT',
    );
  });

  it('enforces unique and well-formed course slugs', async () => {
    const slug = `course-${uniqueSuffix()}`;
    await prisma.course.create({ data: { title: 'A', slug } });
    await rejectsAs(prisma.course.create({ data: { title: 'B', slug } }), 'CONFLICT');
    await rejectsAs(
      prisma.course.create({ data: { title: 'C', slug: 'Not A Slug' } }),
      'VALIDATION_ERROR',
    );
  });

  it('requires publishedAt when a course is PUBLISHED', async () => {
    const s = uniqueSuffix();
    await rejectsAs(
      prisma.course.create({ data: { title: 'P', slug: `p-${s}`, status: 'PUBLISHED' } }),
      'VALIDATION_ERROR',
    );
    await prisma.course.create({
      data: { title: 'P', slug: `p-${s}`, status: 'PUBLISHED', publishedAt: new Date() },
    });
  });

  it('rejects curriculum rows whose parent does not exist (FK)', async () => {
    await rejectsAs(
      prisma.module.create({
        data: { courseId: '00000000-0000-4000-8000-000000000000', title: 'Orphan', position: 0 },
      }),
      'CONFLICT',
    );
  });

  it('keeps sibling positions unique and non-negative', async () => {
    const { course } = await createCourseTree();
    await rejectsAs(
      prisma.module.create({ data: { courseId: course.id, title: 'Clash', position: 0 } }),
      'CONFLICT',
    );
    await rejectsAs(
      prisma.module.create({ data: { courseId: course.id, title: 'Negative', position: -1 } }),
      'VALIDATION_ERROR',
    );
  });

  it('requires exactly one resource location (storage object XOR external URL)', async () => {
    const { lesson } = await createCourseTree();
    const base = { lessonId: lesson.id, title: 'Notes', type: 'PDF' as const };

    await prisma.resource.create({
      data: { ...base, position: 0, storageProvider: 's3', storageKey: 'courses/notes.pdf' },
    });
    await prisma.resource.create({
      data: { ...base, position: 1, type: 'EXTERNAL_LINK', externalUrl: 'https://example.test/x' },
    });

    await rejectsAs(prisma.resource.create({ data: { ...base, position: 2 } }), 'VALIDATION_ERROR');
    await rejectsAs(
      prisma.resource.create({
        data: {
          ...base,
          position: 3,
          storageProvider: 's3',
          storageKey: 'k',
          externalUrl: 'https://example.test/y',
        },
      }),
      'VALIDATION_ERROR',
    );
    await rejectsAs(
      prisma.resource.create({
        data: { ...base, position: 4, storageKey: 'key-without-provider' },
      }),
      'VALIDATION_ERROR',
    );
  });

  it('deleting a course cascades through modules, chapters, lessons and resources', async () => {
    const { course, module, chapter, lesson } = await createCourseTree();
    await prisma.resource.create({
      data: {
        lessonId: lesson.id,
        title: 'Video',
        type: 'VIDEO',
        position: 0,
        externalUrl: 'https://example.test/v',
      },
    });

    await prisma.course.delete({ where: { id: course.id } });

    assert.equal(await prisma.module.count({ where: { id: module.id } }), 0);
    assert.equal(await prisma.chapter.count({ where: { id: chapter.id } }), 0);
    assert.equal(await prisma.lesson.count({ where: { id: lesson.id } }), 0);
    assert.equal(await prisma.resource.count({ where: { lessonId: lesson.id } }), 0);
  });

  it('assigns faculty to a course once, and protects assigned faculty from deletion', async () => {
    const { course } = await createCourseTree();
    const user = await createUser();
    const faculty = await prisma.facultyProfile.create({ data: { userId: user.id } });

    await prisma.courseInstructor.create({
      data: { courseId: course.id, facultyProfileId: faculty.id, isPrimary: true },
    });
    await rejectsAs(
      prisma.courseInstructor.create({
        data: { courseId: course.id, facultyProfileId: faculty.id },
      }),
      'CONFLICT',
    );
    await rejectsAs(prisma.facultyProfile.delete({ where: { id: faculty.id } }), 'CONFLICT');

    // Removing the course removes the assignment, after which the profile can be deleted.
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.facultyProfile.delete({ where: { id: faculty.id } });
  });

  it('maps a missing record to NOT_FOUND', async () => {
    await rejectsAs(
      prisma.user.update({
        where: { id: '00000000-0000-4000-8000-000000000000' },
        data: { fullName: 'Nobody' },
      }),
      'NOT_FOUND',
    );
  });

  it('stores timestamps as UTC instants', async () => {
    const before = Date.now();
    const user = await createUser();
    assert.ok(Math.abs(user.createdAt.getTime() - before) < 60_000);
    const [row] = await prisma.$queryRaw<
      { tz: string }[]
    >`SELECT current_setting('TimeZone') AS tz`;
    assert.ok(row);
    // timestamptz columns store absolute instants regardless of session time zone.
    const [stored] = await prisma.$queryRaw<{ epoch: number }[]>`
      SELECT extract(epoch FROM created_at)::float8 AS epoch FROM users WHERE id = ${user.id}::uuid
    `;
    assert.ok(stored);
    assert.equal(Math.round(stored.epoch * 1000), user.createdAt.getTime());
  });
});
