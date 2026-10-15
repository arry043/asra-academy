import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Data access for Course → Module → Chapter → Lesson → Resource. Ordering is a 0-based
 * `position`, unique within the parent; listings are always `ORDER BY position`.
 */

/** Temporary offset used while rewriting sibling positions (the unique index is not deferrable). */
const REORDER_OFFSET = 1_000_000;

export const resourceOrder = { position: 'asc' } as const;

export const lessonInclude = {
  resources: { orderBy: resourceOrder },
} satisfies Prisma.LessonInclude;

export const chapterInclude = {
  lessons: { orderBy: { position: 'asc' }, include: lessonInclude },
} satisfies Prisma.ChapterInclude;

export const moduleInclude = {
  chapters: { orderBy: { position: 'asc' }, include: chapterInclude },
} satisfies Prisma.ModuleInclude;

export type ResourceRow = Prisma.ResourceGetPayload<object>;
export type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;
export type ChapterRow = Prisma.ChapterGetPayload<{ include: typeof chapterInclude }>;
export type ModuleRow = Prisma.ModuleGetPayload<{ include: typeof moduleInclude }>;

/** Rewrites sibling positions to 0..n-1 in the given order, in two passes. Call in a transaction. */
async function applyOrder(
  ids: string[],
  update: (id: string, position: number) => Promise<unknown>,
): Promise<void> {
  for (const [index, id] of ids.entries()) await update(id, REORDER_OFFSET + index);
  for (const [index, id] of ids.entries()) await update(id, index);
}

const nextPosition = (aggregate: { _max: { position: number | null } }) =>
  (aggregate._max.position ?? -1) + 1;

export function createCurriculumRepository(db: DbClient) {
  return {
    /** Row-locks the course so curriculum changes on one course are serialised. */
    async lockCourse(courseId: string): Promise<boolean> {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "courses" WHERE "id" = ${courseId}::uuid FOR UPDATE`;
      return rows.length > 0;
    },

    findCourse: (courseId: string) =>
      db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true } }),

    tree: (courseId: string) =>
      db.module.findMany({
        where: { courseId },
        orderBy: { position: 'asc' },
        include: moduleInclude,
      }),

    // Parent chains, resolved from the database (never from the request) to find the owning
    // course — this is what prevents cross-course / cross-chapter manipulation (IDOR).
    moduleOwner: (id: string) =>
      db.module.findUnique({ where: { id }, select: { id: true, courseId: true } }),
    chapterOwner: (id: string) =>
      db.chapter.findUnique({
        where: { id },
        select: { id: true, moduleId: true, module: { select: { courseId: true } } },
      }),
    lessonOwner: (id: string) =>
      db.lesson.findUnique({
        where: { id },
        select: {
          id: true,
          chapterId: true,
          status: true,
          contentType: true,
          body: true,
          chapter: { select: { module: { select: { courseId: true } } } },
        },
      }),
    resourceOwner: (id: string) =>
      db.resource.findUnique({
        where: { id },
        select: {
          id: true,
          lessonId: true,
          type: true,
          storageProvider: true,
          storageKey: true,
          externalUrl: true,
          lesson: { select: { chapter: { select: { module: { select: { courseId: true } } } } } },
        },
      }),

    modules: {
      list: (courseId: string) =>
        db.module.findMany({
          where: { courseId },
          orderBy: { position: 'asc' },
          include: moduleInclude,
        }),
      find: (id: string) => db.module.findUnique({ where: { id }, include: moduleInclude }),
      async create(courseId: string, data: { title: string; description?: string | null }) {
        const position = nextPosition(
          await db.module.aggregate({ where: { courseId }, _max: { position: true } }),
        );
        return db.module.create({ data: { ...data, courseId, position }, include: moduleInclude });
      },
      update: (id: string, data: Prisma.ModuleUncheckedUpdateInput) =>
        db.module.update({ where: { id }, data, include: moduleInclude }),
      delete: (id: string) => db.module.delete({ where: { id } }),
      childCount: (id: string) => db.chapter.count({ where: { moduleId: id } }),
      siblingIds: async (courseId: string) =>
        (await db.module.findMany({ where: { courseId }, select: { id: true } })).map((r) => r.id),
      reorder: (ids: string[]) =>
        applyOrder(ids, (id, position) => db.module.update({ where: { id }, data: { position } })),
    },

    chapters: {
      list: (moduleId: string) =>
        db.chapter.findMany({
          where: { moduleId },
          orderBy: { position: 'asc' },
          include: chapterInclude,
        }),
      find: (id: string) => db.chapter.findUnique({ where: { id }, include: chapterInclude }),
      async create(moduleId: string, data: { title: string; description?: string | null }) {
        const position = nextPosition(
          await db.chapter.aggregate({ where: { moduleId }, _max: { position: true } }),
        );
        return db.chapter.create({
          data: { ...data, moduleId, position },
          include: chapterInclude,
        });
      },
      update: (id: string, data: Prisma.ChapterUncheckedUpdateInput) =>
        db.chapter.update({ where: { id }, data, include: chapterInclude }),
      delete: (id: string) => db.chapter.delete({ where: { id } }),
      childCount: (id: string) => db.lesson.count({ where: { chapterId: id } }),
      siblingIds: async (moduleId: string) =>
        (await db.chapter.findMany({ where: { moduleId }, select: { id: true } })).map((r) => r.id),
      reorder: (ids: string[]) =>
        applyOrder(ids, (id, position) => db.chapter.update({ where: { id }, data: { position } })),
    },

    lessons: {
      list: (chapterId: string) =>
        db.lesson.findMany({
          where: { chapterId },
          orderBy: { position: 'asc' },
          include: lessonInclude,
        }),
      find: (id: string) => db.lesson.findUnique({ where: { id }, include: lessonInclude }),
      async create(
        chapterId: string,
        data: Omit<Prisma.LessonUncheckedCreateInput, 'chapterId' | 'position'>,
      ) {
        const position = nextPosition(
          await db.lesson.aggregate({ where: { chapterId }, _max: { position: true } }),
        );
        return db.lesson.create({ data: { ...data, chapterId, position }, include: lessonInclude });
      },
      update: (id: string, data: Prisma.LessonUncheckedUpdateInput) =>
        db.lesson.update({ where: { id }, data, include: lessonInclude }),
      delete: (id: string) => db.lesson.delete({ where: { id } }),
      siblingIds: async (chapterId: string) =>
        (await db.lesson.findMany({ where: { chapterId }, select: { id: true } })).map((r) => r.id),
      reorder: (ids: string[]) =>
        applyOrder(ids, (id, position) => db.lesson.update({ where: { id }, data: { position } })),
    },

    resources: {
      list: (lessonId: string) =>
        db.resource.findMany({ where: { lessonId }, orderBy: resourceOrder }),
      find: (id: string) => db.resource.findUnique({ where: { id } }),
      async create(
        lessonId: string,
        data: Omit<Prisma.ResourceUncheckedCreateInput, 'lessonId' | 'position'>,
      ) {
        const position = nextPosition(
          await db.resource.aggregate({ where: { lessonId }, _max: { position: true } }),
        );
        return db.resource.create({ data: { ...data, lessonId, position } });
      },
      update: (id: string, data: Prisma.ResourceUncheckedUpdateInput) =>
        db.resource.update({ where: { id }, data }),
      delete: (id: string) => db.resource.delete({ where: { id } }),
      siblingIds: async (lessonId: string) =>
        (await db.resource.findMany({ where: { lessonId }, select: { id: true } })).map(
          (r) => r.id,
        ),
      reorder: (ids: string[]) =>
        applyOrder(ids, (id, position) =>
          db.resource.update({ where: { id }, data: { position } }),
        ),
    },
  };
}
