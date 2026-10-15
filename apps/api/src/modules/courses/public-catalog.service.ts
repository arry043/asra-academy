import type { Paginated, PublicCourseDetail, PublicCourseSummary } from '@asra/types';
import type { PublicCourseListQuery } from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { toPublicCourseDetail, toPublicCourseSummary } from './courses.mappers.js';
import { createCoursesRepository } from './courses.repository.js';

/**
 * Anonymous, read-only course catalogue (FR-CRS-004). Visibility is enforced in the database
 * query itself (`PUBLIC_LISTING_WHERE` / `PUBLIC_DETAIL_WHERE`), never by the caller:
 *   - list:   status PUBLISHED and visibility PUBLIC
 *   - detail: status PUBLISHED and visibility PUBLIC or UNLISTED
 * Anything else — drafts, archived, unpublished, PRIVATE, unknown slugs — is the same 404, so a
 * visitor cannot even learn that a hidden course exists. Responses never include lesson bodies,
 * resource URLs, prices or private faculty data.
 */
export const publicCatalogService = {
  async list(query: PublicCourseListQuery): Promise<Paginated<PublicCourseSummary>> {
    const where: Prisma.CourseWhereInput = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
              { subject: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.class ? { class: { slug: query.class } } : {}),
      ...(query.subject ? { subject: { slug: query.subject } } : {}),
    };
    const repo = createCoursesRepository(prisma).public;
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([repo.list(where, skip, take), repo.count(where)]);
    return paginated(rows.map(toPublicCourseSummary), total, query);
  },

  async getBySlug(slug: string): Promise<PublicCourseDetail> {
    const row = await createCoursesRepository(prisma).public.findBySlug(slug);
    if (!row) throw new AppError('NOT_FOUND', 'Course not found');
    return toPublicCourseDetail(row);
  },
};
