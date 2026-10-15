import type {
  AcademicLevelDto,
  CatalogueRef,
  ClassDto,
  Paginated,
  StreamDto,
  SubjectDto,
} from '@asra/types';
import type {
  AcademicLevelCreateInput,
  AcademicLevelUpdateInput,
  CatalogueListQuery,
  ClassCreateInput,
  ClassUpdateInput,
  StreamCreateInput,
  StreamUpdateInput,
  SubjectCreateInput,
  SubjectUpdateInput,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { resolveUniqueSlug } from '../../utils/slug.js';
import {
  createAcademicsRepository,
  type ClassRow,
  type LevelRow,
  type StreamRow,
  type SubjectRow,
} from './academics.repository.js';

/**
 * Academic structure management (FR-ADM-003, FR-ACA-003): everything is data, nothing is
 * hard-coded. Integrity rules (docs/COURSE-MANAGEMENT.md §2):
 *   - names are unique (case-insensitive) within their scope; slugs are unique and stable —
 *     renaming does not change the slug unless a new one is supplied;
 *   - a row used by a PUBLISHED course cannot be deactivated (unpublish or reassign first);
 *   - a row can only be deleted while nothing references it — otherwise deactivate it.
 */

const repo = () => createAcademicsRepository(prisma);

const SLUG_MAX = 120;

function searchWhere(q: string | undefined) {
  return q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};
}

function activeWhere(isActive: boolean | undefined) {
  return isActive === undefined ? {} : { isActive };
}

const ref = (row: { id: string; name: string; slug: string; isActive: boolean }): CatalogueRef => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  isActive: row.isActive,
});

const timestamps = (row: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function toLevelDto(row: LevelRow): AcademicLevelDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    board: row.board,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    classCount: row._count.classes,
    streamCount: row._count.streams,
    ...timestamps(row),
  };
}

export function toClassDto(row: ClassRow): ClassDto {
  return {
    id: row.id,
    academicLevelId: row.academicLevelId,
    academicLevel: ref(row.academicLevel),
    name: row.name,
    slug: row.slug,
    gradeNumber: row.gradeNumber,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    courseCount: row._count.courses,
    ...timestamps(row),
  };
}

export function toStreamDto(row: StreamRow): StreamDto {
  return {
    id: row.id,
    academicLevelId: row.academicLevelId,
    academicLevel: ref(row.academicLevel),
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    courseCount: row._count.courses,
    ...timestamps(row),
  };
}

export function toSubjectDto(row: SubjectRow): SubjectDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description,
    isActive: row.isActive,
    courseCount: row._count.courses,
    ...timestamps(row),
  };
}

function notFound(entity: string): never {
  throw new AppError('NOT_FOUND', `${entity} not found`);
}

function inUse(message: string): never {
  throw new AppError('CONFLICT', message);
}

/** The parent academic level must exist (and be active when it changes). */
async function assertLevelUsable(academicLevelId: string): Promise<void> {
  const level = await repo().levels.findById(academicLevelId);
  if (!level) throw fieldError('VALIDATION_ERROR', 'academicLevelId', 'Academic level not found');
  if (!level.isActive) {
    throw fieldError('VALIDATION_ERROR', 'academicLevelId', 'This academic level is inactive');
  }
}

async function assertNotPublishedWhenDeactivating(
  isActive: boolean | undefined,
  current: boolean,
  where: Parameters<ReturnType<typeof createAcademicsRepository>['countPublishedCourses']>[0],
  label: string,
): Promise<void> {
  if (isActive !== false || current === false) return;
  const published = await repo().countPublishedCourses(where);
  if (published > 0) {
    inUse(
      `This ${label} is used by ${published} published course${published === 1 ? '' : 's'}. ` +
        'Unpublish or reassign them before deactivating it.',
    );
  }
}

// --- Academic levels ------------------------------------------------------------------------

export const academicLevelService = {
  async list(query: CatalogueListQuery): Promise<Paginated<AcademicLevelDto>> {
    const where = { ...searchWhere(query.q), ...activeWhere(query.isActive) };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      repo().levels.list(where, skip, take),
      repo().levels.count(where),
    ]);
    return paginated(rows.map(toLevelDto), total, query);
  },

  async get(id: string): Promise<AcademicLevelDto> {
    return toLevelDto((await repo().levels.findById(id)) ?? notFound('Academic level'));
  },

  async create(input: AcademicLevelCreateInput): Promise<AcademicLevelDto> {
    const levels = repo().levels;
    if (await levels.nameTaken(input.name)) {
      throw fieldError('CONFLICT', 'name', 'An academic level with this name already exists');
    }
    const slug = await resolveUniqueSlug({
      requested: input.slug,
      source: input.name,
      fallback: 'level',
      maxLength: SLUG_MAX,
      isTaken: (candidate) => levels.slugTaken(candidate),
    });
    return toLevelDto(await levels.create({ ...withoutUndefined(input), name: input.name, slug }));
  },

  async update(id: string, input: AcademicLevelUpdateInput): Promise<AcademicLevelDto> {
    const levels = repo().levels;
    const current = (await levels.findById(id)) ?? notFound('Academic level');
    if (input.name && (await levels.nameTaken(input.name, id))) {
      throw fieldError('CONFLICT', 'name', 'An academic level with this name already exists');
    }
    if (input.slug && input.slug !== current.slug && (await levels.slugTaken(input.slug, id))) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    return toLevelDto(await levels.update(id, withoutUndefined(input)));
  },

  async remove(id: string): Promise<void> {
    const level = (await repo().levels.findById(id)) ?? notFound('Academic level');
    if (level._count.classes + level._count.streams > 0) {
      inUse('This academic level still has classes or streams. Deactivate it instead.');
    }
    await repo().levels.delete(id);
  },
};

// --- Classes ----------------------------------------------------------------------------------

export const classService = {
  async list(query: CatalogueListQuery): Promise<Paginated<ClassDto>> {
    const where = {
      ...searchWhere(query.q),
      ...activeWhere(query.isActive),
      ...(query.academicLevelId ? { academicLevelId: query.academicLevelId } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      repo().classes.list(where, skip, take),
      repo().classes.count(where),
    ]);
    return paginated(rows.map(toClassDto), total, query);
  },

  async get(id: string): Promise<ClassDto> {
    return toClassDto((await repo().classes.findById(id)) ?? notFound('Class'));
  },

  async create(input: ClassCreateInput): Promise<ClassDto> {
    const classes = repo().classes;
    await assertLevelUsable(input.academicLevelId);
    if (await classes.nameTaken(input.academicLevelId, input.name)) {
      throw fieldError(
        'CONFLICT',
        'name',
        'This academic level already has a class with this name',
      );
    }
    const slug = await resolveUniqueSlug({
      requested: input.slug,
      source: input.name,
      fallback: 'class',
      maxLength: SLUG_MAX,
      isTaken: (candidate) => classes.slugTaken(candidate),
    });
    return toClassDto(
      await classes.create({
        ...withoutUndefined(input),
        academicLevelId: input.academicLevelId,
        name: input.name,
        slug,
      }),
    );
  },

  async update(id: string, input: ClassUpdateInput): Promise<ClassDto> {
    const classes = repo().classes;
    const current = (await classes.findById(id)) ?? notFound('Class');
    const levelId = input.academicLevelId ?? current.academicLevelId;
    if (input.academicLevelId && input.academicLevelId !== current.academicLevelId) {
      if (current._count.courses + current._count.students > 0) {
        inUse('This class is in use, so its academic level cannot change.');
      }
      await assertLevelUsable(input.academicLevelId);
    }
    if (
      (input.name || input.academicLevelId) &&
      (await classes.nameTaken(levelId, input.name ?? current.name, id))
    ) {
      throw fieldError(
        'CONFLICT',
        'name',
        'This academic level already has a class with this name',
      );
    }
    if (input.slug && input.slug !== current.slug && (await classes.slugTaken(input.slug, id))) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    await assertNotPublishedWhenDeactivating(
      input.isActive,
      current.isActive,
      { classId: id },
      'class',
    );
    return toClassDto(await classes.update(id, withoutUndefined(input)));
  },

  async remove(id: string): Promise<void> {
    const row = (await repo().classes.findById(id)) ?? notFound('Class');
    if (row._count.courses + row._count.students > 0) {
      inUse('This class is used by courses or students. Deactivate it instead.');
    }
    await repo().classes.delete(id);
  },
};

// --- Streams ----------------------------------------------------------------------------------

export const streamService = {
  async list(query: CatalogueListQuery): Promise<Paginated<StreamDto>> {
    const where = {
      ...searchWhere(query.q),
      ...activeWhere(query.isActive),
      ...(query.academicLevelId ? { academicLevelId: query.academicLevelId } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      repo().streams.list(where, skip, take),
      repo().streams.count(where),
    ]);
    return paginated(rows.map(toStreamDto), total, query);
  },

  async get(id: string): Promise<StreamDto> {
    return toStreamDto((await repo().streams.findById(id)) ?? notFound('Stream'));
  },

  async create(input: StreamCreateInput): Promise<StreamDto> {
    const streams = repo().streams;
    await assertLevelUsable(input.academicLevelId);
    if (await streams.nameTaken(input.academicLevelId, input.name)) {
      throw fieldError(
        'CONFLICT',
        'name',
        'This academic level already has a stream with this name',
      );
    }
    const slug = await resolveUniqueSlug({
      requested: input.slug,
      source: input.name,
      fallback: 'stream',
      maxLength: SLUG_MAX,
      isTaken: (candidate) => streams.slugTaken(candidate),
    });
    return toStreamDto(
      await streams.create({
        ...withoutUndefined(input),
        academicLevelId: input.academicLevelId,
        name: input.name,
        slug,
      }),
    );
  },

  async update(id: string, input: StreamUpdateInput): Promise<StreamDto> {
    const streams = repo().streams;
    const current = (await streams.findById(id)) ?? notFound('Stream');
    const levelId = input.academicLevelId ?? current.academicLevelId;
    if (input.academicLevelId && input.academicLevelId !== current.academicLevelId) {
      if (current._count.courses + current._count.students > 0) {
        inUse('This stream is in use, so its academic level cannot change.');
      }
      await assertLevelUsable(input.academicLevelId);
    }
    if (
      (input.name || input.academicLevelId) &&
      (await streams.nameTaken(levelId, input.name ?? current.name, id))
    ) {
      throw fieldError(
        'CONFLICT',
        'name',
        'This academic level already has a stream with this name',
      );
    }
    if (input.slug && input.slug !== current.slug && (await streams.slugTaken(input.slug, id))) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    await assertNotPublishedWhenDeactivating(
      input.isActive,
      current.isActive,
      { streamId: id },
      'stream',
    );
    return toStreamDto(await streams.update(id, withoutUndefined(input)));
  },

  async remove(id: string): Promise<void> {
    const row = (await repo().streams.findById(id)) ?? notFound('Stream');
    if (row._count.courses + row._count.students > 0) {
      inUse('This stream is used by courses or students. Deactivate it instead.');
    }
    await repo().streams.delete(id);
  },
};

// --- Subjects ---------------------------------------------------------------------------------

export const subjectService = {
  async list(query: CatalogueListQuery): Promise<Paginated<SubjectDto>> {
    const q = query.q;
    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { slug: { contains: q, mode: 'insensitive' as const } },
              { code: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...activeWhere(query.isActive),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      repo().subjects.list(where, skip, take),
      repo().subjects.count(where),
    ]);
    return paginated(rows.map(toSubjectDto), total, query);
  },

  async get(id: string): Promise<SubjectDto> {
    return toSubjectDto((await repo().subjects.findById(id)) ?? notFound('Subject'));
  },

  async create(input: SubjectCreateInput): Promise<SubjectDto> {
    const subjects = repo().subjects;
    if (await subjects.nameTaken(input.name)) {
      throw fieldError('CONFLICT', 'name', 'A subject with this name already exists');
    }
    if (input.code && (await subjects.codeTaken(input.code))) {
      throw fieldError('CONFLICT', 'code', 'A subject with this code already exists');
    }
    const slug = await resolveUniqueSlug({
      requested: input.slug,
      source: input.name,
      fallback: 'subject',
      maxLength: SLUG_MAX,
      isTaken: (candidate) => subjects.slugTaken(candidate),
    });
    return toSubjectDto(
      await subjects.create({ ...withoutUndefined(input), name: input.name, slug }),
    );
  },

  async update(id: string, input: SubjectUpdateInput): Promise<SubjectDto> {
    const subjects = repo().subjects;
    const current = (await subjects.findById(id)) ?? notFound('Subject');
    if (input.name && (await subjects.nameTaken(input.name, id))) {
      throw fieldError('CONFLICT', 'name', 'A subject with this name already exists');
    }
    if (input.code && (await subjects.codeTaken(input.code, id))) {
      throw fieldError('CONFLICT', 'code', 'A subject with this code already exists');
    }
    if (input.slug && input.slug !== current.slug && (await subjects.slugTaken(input.slug, id))) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    await assertNotPublishedWhenDeactivating(
      input.isActive,
      current.isActive,
      { subjectId: id },
      'subject',
    );
    return toSubjectDto(await subjects.update(id, withoutUndefined(input)));
  },

  async remove(id: string): Promise<void> {
    const row = (await repo().subjects.findById(id)) ?? notFound('Subject');
    if (row._count.courses > 0) {
      inUse('This subject is used by courses. Deactivate it instead.');
    }
    await repo().subjects.delete(id);
  },
};
