import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Data access for course categories, courses, instructor assignments and the public catalogue.
 * Reads of catalogue rows (class/stream/subject) here are lookups for validation only; the
 * academic structure itself is managed by the academics module.
 */

const refSelect = { select: { id: true, name: true, slug: true, isActive: true } } as const;

export const categoryInclude = {
  _count: { select: { courses: true } },
} satisfies Prisma.CourseCategoryInclude;

export type CategoryRow = Prisma.CourseCategoryGetPayload<{ include: typeof categoryInclude }>;

/** Faculty data needed to show and validate an instructor. Never emails or phone numbers. */
export const facultySelect = {
  id: true,
  designation: true,
  employeeCode: true,
  isPublic: true,
  user: {
    select: {
      fullName: true,
      status: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  },
} satisfies Prisma.FacultyProfileSelect;

export type FacultyRow = Prisma.FacultyProfileGetPayload<{ select: typeof facultySelect }>;

export const courseInclude = {
  category: refSelect,
  class: refSelect,
  stream: refSelect,
  subject: refSelect,
  instructors: {
    select: { isPrimary: true, facultyProfile: { select: facultySelect } },
    orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
  },
} satisfies Prisma.CourseInclude;

export type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

/** Course + the curriculum facts the publication rules need (no bodies beyond lessons). */
export const publicationInclude = {
  ...courseInclude,
  modules: {
    select: {
      id: true,
      chapters: {
        select: {
          id: true,
          lessons: {
            select: {
              id: true,
              title: true,
              status: true,
              contentType: true,
              body: true,
              resources: { select: { type: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type CourseWithCurriculumRow = Prisma.CourseGetPayload<{
  include: typeof publicationInclude;
}>;

const PUBLIC_INSTRUCTORS = {
  where: { facultyProfile: { isPublic: true, user: { status: 'ACTIVE' as const } } },
  select: {
    facultyProfile: { select: { designation: true, user: { select: { fullName: true } } } },
  },
  orderBy: [{ isPrimary: 'desc' as const }, { assignedAt: 'asc' as const }],
};

const publicRef = { select: { name: true, slug: true } } as const;

export const publicCourseSelect = {
  slug: true,
  title: true,
  summary: true,
  thumbnailUrl: true,
  durationMinutes: true,
  publishedAt: true,
  category: publicRef,
  class: publicRef,
  stream: publicRef,
  subject: publicRef,
  instructors: PUBLIC_INSTRUCTORS,
} satisfies Prisma.CourseSelect;

export const publicCourseDetailSelect = {
  ...publicCourseSelect,
  description: true,
  visibility: true,
  modules: {
    orderBy: { position: 'asc' },
    select: {
      title: true,
      description: true,
      chapters: {
        orderBy: { position: 'asc' },
        select: {
          title: true,
          lessons: {
            where: { status: 'PUBLISHED' },
            orderBy: { position: 'asc' },
            select: { title: true, contentType: true, durationSeconds: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CourseSelect;

export type PublicCourseRow = Prisma.CourseGetPayload<{ select: typeof publicCourseSelect }>;
export type PublicCourseDetailRow = Prisma.CourseGetPayload<{
  select: typeof publicCourseDetailSelect;
}>;

/** Only these states are ever visible to anonymous visitors (docs/COURSE-MANAGEMENT.md §3). */
export const PUBLIC_LISTING_WHERE = {
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
} satisfies Prisma.CourseWhereInput;

export const PUBLIC_DETAIL_WHERE = {
  status: 'PUBLISHED',
  visibility: { in: ['PUBLIC', 'UNLISTED'] },
} satisfies Prisma.CourseWhereInput;

const sameText = (value: string) => ({ equals: value, mode: 'insensitive' as const });
const notId = (id?: string) => (id ? { NOT: { id } } : {});

export function createCoursesRepository(db: DbClient) {
  return {
    categories: {
      list(where: Prisma.CourseCategoryWhereInput, skip: number, take: number) {
        return db.courseCategory.findMany({
          where,
          include: categoryInclude,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.CourseCategoryWhereInput) => db.courseCategory.count({ where }),
      findById: (id: string) =>
        db.courseCategory.findUnique({ where: { id }, include: categoryInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.courseCategory.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      async nameTaken(name: string, excludeId?: string) {
        const where = { name: sameText(name), ...notId(excludeId) };
        return (await db.courseCategory.count({ where })) > 0;
      },
      create: (data: Prisma.CourseCategoryUncheckedCreateInput) =>
        db.courseCategory.create({ data, include: categoryInclude }),
      update: (id: string, data: Prisma.CourseCategoryUncheckedUpdateInput) =>
        db.courseCategory.update({ where: { id }, data, include: categoryInclude }),
      delete: (id: string) => db.courseCategory.delete({ where: { id } }),
      countPublishedCourses: (categoryId: string) =>
        db.course.count({ where: { categoryId, status: 'PUBLISHED' } }),
    },

    /** Relation targets of a course, with what validation needs. */
    relations: {
      category: (id: string) =>
        db.courseCategory.findUnique({ where: { id }, select: { id: true, isActive: true } }),
      class: (id: string) =>
        db.class.findUnique({
          where: { id },
          select: { id: true, isActive: true, academicLevelId: true },
        }),
      stream: (id: string) =>
        db.stream.findUnique({
          where: { id },
          select: { id: true, isActive: true, academicLevelId: true },
        }),
      subject: (id: string) =>
        db.subject.findUnique({ where: { id }, select: { id: true, isActive: true } }),
    },

    courses: {
      list(where: Prisma.CourseWhereInput, skip: number, take: number) {
        return db.course.findMany({
          where,
          include: courseInclude,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.CourseWhereInput) => db.course.count({ where }),
      findById: (id: string) => db.course.findUnique({ where: { id }, include: courseInclude }),
      findWithCurriculum: (id: string) =>
        db.course.findUnique({ where: { id }, include: publicationInclude }),
      async slugTaken(slug: string, excludeId?: string) {
        return (await db.course.count({ where: { slug, ...notId(excludeId) } })) > 0;
      },
      create: (data: Prisma.CourseUncheckedCreateInput) =>
        db.course.create({ data, include: courseInclude }),
      update: (id: string, data: Prisma.CourseUncheckedUpdateInput) =>
        db.course.update({ where: { id }, data, include: courseInclude }),
      delete: (id: string) => db.course.delete({ where: { id } }),
      countModules: (courseId: string) => db.module.count({ where: { courseId } }),
      /**
       * Row lock for the rest of the transaction, so concurrent publish/edit requests on the same
       * course are serialised (`SELECT … FOR UPDATE`). Returns false when the course is missing.
       */
      async lock(id: string): Promise<boolean> {
        const rows = await db.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "courses" WHERE "id" = ${id}::uuid FOR UPDATE`;
        return rows.length > 0;
      },
    },

    instructors: {
      /** Replaces the whole assignment list. Call inside a transaction. */
      async replace(courseId: string, items: { facultyProfileId: string; isPrimary: boolean }[]) {
        await db.courseInstructor.deleteMany({ where: { courseId } });
        if (items.length > 0) {
          await db.courseInstructor.createMany({
            data: items.map((item) => ({ courseId, ...item })),
          });
        }
      },
    },

    faculty: {
      /** Faculty profiles whose user holds the FACULTY role (never students or admins). */
      list(q: string | undefined, take: number) {
        return db.facultyProfile.findMany({
          where: {
            user: { roles: { some: { role: { key: 'FACULTY' } } } },
            ...(q
              ? {
                  OR: [
                    { user: { fullName: { contains: q, mode: 'insensitive' } } },
                    { designation: { contains: q, mode: 'insensitive' } },
                    { employeeCode: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          select: facultySelect,
          orderBy: { user: { fullName: 'asc' } },
          take,
        });
      },
      findByIds: (ids: string[]) =>
        db.facultyProfile.findMany({ where: { id: { in: ids } }, select: facultySelect }),
    },

    public: {
      list(where: Prisma.CourseWhereInput, skip: number, take: number) {
        return db.course.findMany({
          where: { ...where, ...PUBLIC_LISTING_WHERE },
          select: publicCourseSelect,
          orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
          skip,
          take,
        });
      },
      count: (where: Prisma.CourseWhereInput) =>
        db.course.count({ where: { ...where, ...PUBLIC_LISTING_WHERE } }),
      findBySlug: (slug: string) =>
        db.course.findFirst({
          where: { slug, ...PUBLIC_DETAIL_WHERE },
          select: publicCourseDetailSelect,
        }),
    },
  };
}
