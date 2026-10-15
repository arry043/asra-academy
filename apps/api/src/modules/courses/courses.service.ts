import type {
  AdminCourseDetail,
  AdminCourseListItem,
  FacultyOptionDto,
  Paginated,
} from '@asra/types';
import {
  validateCoursePricing,
  type AdminCourseListQuery,
  type CourseCreateInput,
  type CourseInstructorsInput,
  type CourseTransitionInput,
  type CourseUpdateInput,
  type FacultyOptionsQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError, fieldError, type FieldErrorDetail } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { resolveUniqueSlug } from '../../utils/slug.js';
import {
  isAssignableFaculty,
  toCourseDetail,
  toCourseListItem,
  toFacultyOption,
  toPublicationSnapshot,
} from './courses.mappers.js';
import { createCoursesRepository } from './courses.repository.js';
import { evaluatePublication } from './publication.js';

/**
 * Course management (FR-ADM-004, FR-CRS-002): CRUD, faculty assignment and the publication
 * lifecycle. Lifecycle (docs/COURSE-MANAGEMENT.md §3):
 *
 *   DRAFT ──publish (eligible)──▶ PUBLISHED ──unpublish──▶ DRAFT
 *   DRAFT ──archive──▶ ARCHIVED ──restore──▶ DRAFT
 *   delete: DRAFT/ARCHIVED with no modules only (curriculum is never cascaded away by accident)
 *
 * Every mutation runs in a transaction that row-locks the course, so concurrent requests are
 * serialised; `expectedUpdatedAt` (optional) turns a stale edit into 409 instead of an overwrite.
 */

const SLUG_MAX = 220;

type CourseRelations = Pick<CourseCreateInput, 'categoryId' | 'classId' | 'streamId' | 'subjectId'>;
type RelationIds = { [K in keyof CourseRelations]-?: string | null };

function notFound(): never {
  throw new AppError('NOT_FOUND', 'Course not found');
}

async function lockOrThrow(db: DbClient, id: string): Promise<void> {
  if (!(await createCoursesRepository(db).courses.lock(id))) notFound();
}

function assertFresh(current: { updatedAt: Date }, expectedUpdatedAt: string | undefined): void {
  if (
    expectedUpdatedAt &&
    current.updatedAt.toISOString() !== new Date(expectedUpdatedAt).toISOString()
  ) {
    throw new AppError(
      'CONFLICT',
      'This course was changed by someone else since you opened it. Reload it and try again.',
    );
  }
}

/**
 * Validates the course's relations. Rows that are newly linked must exist and be active; rows
 * already linked may stay even if they were deactivated later (so unrelated edits still save).
 * A stream needs a class from the same academic level.
 */
async function validateRelations(db: DbClient, next: RelationIds, previous?: RelationIds) {
  const relations = createCoursesRepository(db).relations;
  const issues: FieldErrorDetail[] = [];
  const changed = (key: keyof RelationIds) => !previous || previous[key] !== next[key];

  const [category, klass, stream, subject] = await Promise.all([
    next.categoryId ? relations.category(next.categoryId) : null,
    next.classId ? relations.class(next.classId) : null,
    next.streamId ? relations.stream(next.streamId) : null,
    next.subjectId ? relations.subject(next.subjectId) : null,
  ]);

  const check = (key: keyof RelationIds, row: { isActive: boolean } | null, label: string) => {
    if (!next[key]) return;
    if (!row) issues.push({ path: [key], message: `${label} not found` });
    else if (!row.isActive && changed(key)) {
      issues.push({ path: [key], message: `This ${label.toLowerCase()} is inactive` });
    }
  };
  check('categoryId', category, 'Category');
  check('classId', klass, 'Class');
  check('streamId', stream, 'Stream');
  check('subjectId', subject, 'Subject');

  if (stream && !next.classId) {
    issues.push({ path: ['streamId'], message: 'Choose a class before choosing a stream' });
  } else if (stream && klass && stream.academicLevelId !== klass.academicLevelId) {
    issues.push({
      path: ['streamId'],
      message: 'This stream belongs to a different academic level than the class',
    });
  }

  if (issues.length > 0) {
    throw new AppError('VALIDATION_ERROR', issues[0]!.message, issues);
  }
}

function assertPricing(pricing: Parameters<typeof validateCoursePricing>[0]): void {
  const issues = validateCoursePricing(pricing);
  if (issues.length > 0) throw new AppError('VALIDATION_ERROR', issues[0]!.message, issues);
}

/** Loads the course + curriculum facts and evaluates the publication rules. */
async function checkPublication(db: DbClient, courseId: string) {
  const row = await createCoursesRepository(db).courses.findWithCurriculum(courseId);
  if (!row) notFound();
  return { row, check: evaluatePublication(toPublicationSnapshot(row)) };
}

function ineligible(
  prefix: string,
  issues: { path: string[]; message: string; code: string }[],
): never {
  throw new AppError('VALIDATION_ERROR', `${prefix} ${issues[0]!.message}`, issues);
}

/**
 * Shared with the curriculum module: call inside the transaction AFTER changing a course or its
 * curriculum. If the course is PUBLISHED and the change made it ineligible, the transaction is
 * rolled back with 422 and the list of broken requirements.
 */
export const coursePublicationGuard = {
  async assertStillPublishable(db: DbClient, courseId: string): Promise<void> {
    const { row, check } = await checkPublication(db, courseId);
    if (row.status === 'PUBLISHED' && !check.eligible) {
      ineligible(
        'This change would leave the published course without required information. Unpublish it first, or fix:',
        check.issues,
      );
    }
  },
};

async function detail(db: DbClient, id: string): Promise<AdminCourseDetail> {
  const row = await createCoursesRepository(db).courses.findWithCurriculum(id);
  return toCourseDetail(row ?? notFound());
}

export const courseService = {
  async list(query: AdminCourseListQuery): Promise<Paginated<AdminCourseListItem>> {
    const where: Prisma.CourseWhereInput = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };
    const repo = createCoursesRepository(prisma).courses;
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([repo.list(where, skip, take), repo.count(where)]);
    return paginated(rows.map(toCourseListItem), total, query);
  },

  get: (id: string) => detail(prisma, id),

  async create(input: CourseCreateInput): Promise<AdminCourseDetail> {
    return prisma.$transaction(async (tx) => {
      const repo = createCoursesRepository(tx).courses;
      await validateRelations(tx, {
        categoryId: input.categoryId ?? null,
        classId: input.classId ?? null,
        streamId: input.streamId ?? null,
        subjectId: input.subjectId ?? null,
      });
      const slug = await resolveUniqueSlug({
        requested: input.slug,
        source: input.title,
        fallback: 'course',
        maxLength: SLUG_MAX,
        isTaken: (candidate) => repo.slugTaken(candidate),
      });
      // New courses always start as DRAFT; status is changed only through the transitions.
      const created = await repo.create({ ...withoutUndefined(input), title: input.title, slug });
      return detail(tx, created.id);
    });
  },

  async update(id: string, input: CourseUpdateInput): Promise<AdminCourseDetail> {
    const { expectedUpdatedAt, ...changes } = input;
    return prisma.$transaction(async (tx) => {
      await lockOrThrow(tx, id);
      const repo = createCoursesRepository(tx).courses;
      const current = (await repo.findById(id)) ?? notFound();
      assertFresh(current, expectedUpdatedAt);

      const pick = <K extends keyof RelationIds>(key: K) =>
        changes[key] === undefined ? current[key] : (changes[key] ?? null);
      await validateRelations(
        tx,
        {
          categoryId: pick('categoryId'),
          classId: pick('classId'),
          streamId: pick('streamId'),
          subjectId: pick('subjectId'),
        },
        current,
      );
      assertPricing({
        priceMinor: changes.priceMinor === undefined ? current.priceMinor : changes.priceMinor,
        currency: changes.currency === undefined ? current.currency : changes.currency,
        discountType:
          changes.discountType === undefined ? current.discountType : changes.discountType,
        discountValue:
          changes.discountValue === undefined ? current.discountValue : changes.discountValue,
      });
      if (
        changes.slug &&
        changes.slug !== current.slug &&
        (await repo.slugTaken(changes.slug, id))
      ) {
        throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
      }

      await repo.update(id, withoutUndefined(changes));
      await coursePublicationGuard.assertStillPublishable(tx, id);
      return detail(tx, id);
    });
  },

  async setInstructors(id: string, input: CourseInstructorsInput): Promise<AdminCourseDetail> {
    return prisma.$transaction(async (tx) => {
      await lockOrThrow(tx, id);
      const repo = createCoursesRepository(tx);
      const current = (await repo.courses.findById(id)) ?? notFound();
      const alreadyAssigned = new Set(current.instructors.map((item) => item.facultyProfile.id));

      const ids = input.instructors.map((item) => item.facultyProfileId);
      const faculty = new Map((await repo.faculty.findByIds(ids)).map((row) => [row.id, row]));
      for (const id of ids) {
        const row = faculty.get(id);
        if (!row || !row.user.roles.some((r) => r.role.key === 'FACULTY')) {
          throw fieldError(
            'VALIDATION_ERROR',
            'instructors',
            'One of the selected faculty members was not found',
          );
        }
        // Existing assignments may stay; new ones need an active faculty account.
        if (!alreadyAssigned.has(id) && !isAssignableFaculty(row)) {
          throw fieldError(
            'VALIDATION_ERROR',
            'instructors',
            `${row.user.fullName} cannot be assigned: the account is not active`,
          );
        }
      }

      await repo.instructors.replace(id, input.instructors);
      // Assignment changes are course edits: bump `updatedAt` for concurrency checks and lists.
      await repo.courses.update(id, { updatedAt: new Date() });
      await coursePublicationGuard.assertStillPublishable(tx, id);
      return detail(tx, id);
    });
  },

  async publish(id: string, input: CourseTransitionInput): Promise<AdminCourseDetail> {
    return prisma.$transaction(async (tx) => {
      await lockOrThrow(tx, id);
      const { row, check } = await checkPublication(tx, id);
      assertFresh(row, input.expectedUpdatedAt);
      if (row.status === 'PUBLISHED')
        throw new AppError('CONFLICT', 'This course is already published');
      if (row.status === 'ARCHIVED') {
        throw new AppError(
          'CONFLICT',
          'Archived courses cannot be published. Restore it to draft first.',
        );
      }
      if (!check.eligible) ineligible('This course cannot be published yet.', check.issues);

      await createCoursesRepository(tx).courses.update(id, {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      return detail(tx, id);
    });
  },

  async unpublish(id: string, input: CourseTransitionInput): Promise<AdminCourseDetail> {
    return transition(
      id,
      input,
      'PUBLISHED',
      { status: 'DRAFT', publishedAt: null },
      'Only published courses can be unpublished',
    );
  },

  async archive(id: string, input: CourseTransitionInput): Promise<AdminCourseDetail> {
    return transition(
      id,
      input,
      'DRAFT',
      { status: 'ARCHIVED' },
      'Only draft courses can be archived. Unpublish it first.',
    );
  },

  async restore(id: string, input: CourseTransitionInput): Promise<AdminCourseDetail> {
    return transition(
      id,
      input,
      'ARCHIVED',
      { status: 'DRAFT' },
      'Only archived courses can be restored',
    );
  },

  async remove(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockOrThrow(tx, id);
      const repo = createCoursesRepository(tx).courses;
      const current = (await repo.findById(id)) ?? notFound();
      if (current.status === 'PUBLISHED') {
        throw new AppError('CONFLICT', 'Published courses cannot be deleted. Unpublish it first.');
      }
      if ((await repo.countModules(id)) > 0) {
        throw new AppError(
          'CONFLICT',
          'This course has curriculum content. Archive it instead, or delete its modules first.',
        );
      }
      await repo.delete(id);
    });
  },

  async facultyOptions(query: FacultyOptionsQuery): Promise<FacultyOptionDto[]> {
    const rows = await createCoursesRepository(prisma).faculty.list(query.q, query.limit);
    return rows.map(toFacultyOption);
  },
};

async function transition(
  id: string,
  input: CourseTransitionInput,
  from: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  data: Prisma.CourseUncheckedUpdateInput,
  wrongStateMessage: string,
): Promise<AdminCourseDetail> {
  return prisma.$transaction(async (tx) => {
    await lockOrThrow(tx, id);
    const repo = createCoursesRepository(tx).courses;
    const current = (await repo.findById(id)) ?? notFound();
    assertFresh(current, input.expectedUpdatedAt);
    if (current.status !== from) throw new AppError('CONFLICT', wrongStateMessage);
    await repo.update(id, data);
    return detail(tx, id);
  });
}
