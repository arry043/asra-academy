import type { CourseCategoryDto, Paginated } from '@asra/types';
import type {
  CatalogueListQuery,
  CourseCategoryCreateInput,
  CourseCategoryUpdateInput,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { resolveUniqueSlug } from '../../utils/slug.js';
import { toCategoryDto } from './courses.mappers.js';
import { createCoursesRepository } from './courses.repository.js';

/** Course categories (FR-ADM-004). Same integrity rules as the academic catalogue. */

const categories = () => createCoursesRepository(prisma).categories;

async function findOrThrow(id: string) {
  const row = await categories().findById(id);
  if (!row) throw new AppError('NOT_FOUND', 'Course category not found');
  return row;
}

export const courseCategoryService = {
  async list(query: CatalogueListQuery): Promise<Paginated<CourseCategoryDto>> {
    const where = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { slug: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      categories().list(where, skip, take),
      categories().count(where),
    ]);
    return paginated(rows.map(toCategoryDto), total, query);
  },

  async get(id: string): Promise<CourseCategoryDto> {
    return toCategoryDto(await findOrThrow(id));
  },

  async create(input: CourseCategoryCreateInput): Promise<CourseCategoryDto> {
    const repo = categories();
    if (await repo.nameTaken(input.name)) {
      throw fieldError('CONFLICT', 'name', 'A category with this name already exists');
    }
    const slug = await resolveUniqueSlug({
      requested: input.slug,
      source: input.name,
      fallback: 'category',
      maxLength: 120,
      isTaken: (candidate) => repo.slugTaken(candidate),
    });
    return toCategoryDto(await repo.create({ ...withoutUndefined(input), name: input.name, slug }));
  },

  async update(id: string, input: CourseCategoryUpdateInput): Promise<CourseCategoryDto> {
    const repo = categories();
    const current = await findOrThrow(id);
    if (input.name && (await repo.nameTaken(input.name, id))) {
      throw fieldError('CONFLICT', 'name', 'A category with this name already exists');
    }
    if (input.slug && input.slug !== current.slug && (await repo.slugTaken(input.slug, id))) {
      throw fieldError('CONFLICT', 'slug', 'This slug is already in use. Choose another one.');
    }
    if (input.isActive === false && current.isActive) {
      const published = await repo.countPublishedCourses(id);
      if (published > 0) {
        throw new AppError(
          'CONFLICT',
          `This category is used by ${published} published course${published === 1 ? '' : 's'}. ` +
            'Unpublish or reassign them before deactivating it.',
        );
      }
    }
    return toCategoryDto(await repo.update(id, withoutUndefined(input)));
  },

  async remove(id: string): Promise<void> {
    const row = await findOrThrow(id);
    if (row._count.courses > 0) {
      throw new AppError('CONFLICT', 'This category is used by courses. Deactivate it instead.');
    }
    await categories().delete(id);
  },
};
