import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Data access for the student LMS. Every query that returns student data takes the student's
 * `userId` from the authenticated context — never from the URL or body.
 */

const publicRef = { select: { name: true, slug: true } } as const;

/** The public face of a course, as students see it in lists. */
export const courseRefSelect = {
  id: true,
  title: true,
  slug: true,
  thumbnailUrl: true,
  category: publicRef,
  class: publicRef,
  stream: publicRef,
  subject: publicRef,
} satisfies Prisma.CourseSelect;

export type CourseRefRow = Prisma.CourseGetPayload<{ select: typeof courseRefSelect }>;

/** Only faculty whose profile is public are shown to students (C-02, Z-05). */
export const studentInstructorsSelect = {
  where: { facultyProfile: { isPublic: true, user: { status: 'ACTIVE' as const } } },
  select: {
    facultyProfile: { select: { designation: true, user: { select: { fullName: true } } } },
  },
  orderBy: [{ isPrimary: 'desc' as const }, { assignedAt: 'asc' as const }],
};

export const enrollmentSelect = {
  id: true,
  userId: true,
  courseId: true,
  status: true,
  source: true,
  enrolledAt: true,
  cancelledAt: true,
  completedAt: true,
  lastLessonId: true,
  lastActivityAt: true,
} satisfies Prisma.EnrollmentSelect;

export type EnrollmentRow = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

export const enrollmentWithCourseSelect = {
  ...enrollmentSelect,
  course: { select: courseRefSelect },
} satisfies Prisma.EnrollmentSelect;

export type EnrollmentWithCourseRow = Prisma.EnrollmentGetPayload<{
  select: typeof enrollmentWithCourseSelect;
}>;

/**
 * The student-visible curriculum: modules → chapters → PUBLISHED lessons in CMS order. Draft
 * lessons are filtered in the query, so they can never leak into a response by mistake.
 */
const structureSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  chapters: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      lessons: {
        where: { status: 'PUBLISHED' },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          contentType: true,
          durationSeconds: true,
          _count: { select: { resources: true } },
        },
      },
    },
  },
} satisfies Prisma.ModuleSelect;

export type StructureModuleRow = Prisma.ModuleGetPayload<{ select: typeof structureSelect }>;

export const progressSelect = {
  lessonId: true,
  firstViewedAt: true,
  lastViewedAt: true,
  completedAt: true,
  videoPositionSeconds: true,
  videoWatchedSeconds: true,
  videoHeartbeatAt: true,
  videoCompletedAt: true,
} satisfies Prisma.LessonProgressSelect;

export type ProgressRow = Prisma.LessonProgressGetPayload<{ select: typeof progressSelect }>;

/** Lesson + the chain up to its course, for ownership checks and the player header. */
export const lessonWithOwnerSelect = {
  id: true,
  title: true,
  description: true,
  contentType: true,
  body: true,
  status: true,
  durationSeconds: true,
  chapter: {
    select: {
      id: true,
      title: true,
      module: { select: { id: true, title: true, courseId: true } },
    },
  },
  resources: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      type: true,
      externalUrl: true,
      storageProvider: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
} satisfies Prisma.LessonSelect;

export type LessonWithOwnerRow = Prisma.LessonGetPayload<{ select: typeof lessonWithOwnerSelect }>;

export function createStudentRepository(db: DbClient) {
  return {
    course: {
      /** Only what the access decision needs. */
      findForAccess: (id: string) =>
        db.course.findUnique({
          where: { id },
          select: { id: true, title: true, status: true, visibility: true, priceMinor: true },
        }),
      findOverview: (id: string) =>
        db.course.findUnique({
          where: { id },
          select: {
            ...courseRefSelect,
            status: true,
            visibility: true,
            priceMinor: true,
            currency: true,
            discountType: true,
            discountValue: true,
            summary: true,
            description: true,
            durationMinutes: true,
            instructors: studentInstructorsSelect,
          },
        }),
      /** Published courses visible in the student catalogue (PUBLIC listing rule of PHASE 06). */
      catalog(where: Prisma.CourseWhereInput, skip: number, take: number) {
        return db.course.findMany({
          where: { ...where, status: 'PUBLISHED', visibility: 'PUBLIC' },
          select: {
            ...courseRefSelect,
            summary: true,
            durationMinutes: true,
            priceMinor: true,
            currency: true,
            discountType: true,
            discountValue: true,
            instructors: studentInstructorsSelect,
          },
          orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
          skip,
          take,
        });
      },
      catalogCount: (where: Prisma.CourseWhereInput) =>
        db.course.count({ where: { ...where, status: 'PUBLISHED', visibility: 'PUBLIC' } }),
      /** Row lock for the rest of the transaction (serialises enrolment creation per course). */
      async lock(id: string): Promise<boolean> {
        const rows = await db.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "courses" WHERE "id" = ${id}::uuid FOR UPDATE`;
        return rows.length > 0;
      },
    },

    /** Curriculum of several courses in ONE query (no N+1), grouped by course. */
    async structures(courseIds: string[]): Promise<Map<string, StructureModuleRow[]>> {
      const map = new Map<string, StructureModuleRow[]>(courseIds.map((id) => [id, []]));
      if (courseIds.length === 0) return map;
      const modules = await db.module.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: [{ courseId: 'asc' }, { position: 'asc' }],
        select: structureSelect,
      });
      for (const module of modules) map.get(module.courseId)?.push(module);
      return map;
    },

    enrollments: {
      find: (userId: string, courseId: string) =>
        db.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
          select: enrollmentSelect,
        }),
      list(where: Prisma.EnrollmentWhereInput, skip: number, take: number) {
        return db.enrollment.findMany({
          where,
          select: enrollmentWithCourseSelect,
          // Most recently active first; never-opened courses by enrolment date.
          orderBy: [
            { lastActivityAt: { sort: 'desc', nulls: 'last' } },
            { enrolledAt: 'desc' },
            { id: 'asc' },
          ],
          skip,
          take,
        });
      },
      count: (where: Prisma.EnrollmentWhereInput) => db.enrollment.count({ where }),
      /** ACTIVE enrolments in PUBLISHED courses — the ones that currently grant access. */
      accessibleWhere: (userId: string): Prisma.EnrollmentWhereInput => ({
        userId,
        status: 'ACTIVE',
        course: { status: 'PUBLISHED' },
      }),
      touch: (id: string, lessonId: string, at: Date) =>
        db.enrollment.update({
          where: { id },
          data: { lastLessonId: lessonId, lastActivityAt: at },
        }),
      markCompleted: (id: string, at: Date) =>
        db.enrollment.updateMany({ where: { id, completedAt: null }, data: { completedAt: at } }),
    },

    progress: {
      find: (userId: string, lessonId: string) =>
        db.lessonProgress.findUnique({
          where: { userId_lessonId: { userId, lessonId } },
          select: progressSelect,
        }),
      /** Rows for these lessons only. */
      forLessons: (userId: string, lessonIds: string[]) =>
        lessonIds.length === 0
          ? Promise.resolve([])
          : db.lessonProgress.findMany({
              where: { userId, lessonId: { in: lessonIds } },
              select: progressSelect,
            }),
      /** Opening a lesson: creates the row on first view, otherwise refreshes `lastViewedAt`. */
      recordView: (userId: string, lessonId: string, at: Date) =>
        db.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId } },
          create: { userId, lessonId, firstViewedAt: at, lastViewedAt: at },
          update: { lastViewedAt: at },
          select: progressSelect,
        }),
      /**
       * Locks the student's row for this lesson (creating it first if needed), so concurrent
       * heartbeats/completions are applied one at a time.
       */
      async lock(userId: string, lessonId: string, at: Date): Promise<ProgressRow> {
        await db.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId } },
          create: { userId, lessonId, firstViewedAt: at, lastViewedAt: at },
          update: {},
          select: { id: true },
        });
        await db.$queryRaw`
          SELECT "id" FROM "lesson_progress"
          WHERE "user_id" = ${userId}::uuid AND "lesson_id" = ${lessonId}::uuid FOR UPDATE`;
        return db.lessonProgress.findUniqueOrThrow({
          where: { userId_lessonId: { userId, lessonId } },
          select: progressSelect,
        });
      },
      update: (userId: string, lessonId: string, data: Prisma.LessonProgressUpdateInput) =>
        db.lessonProgress.update({
          where: { userId_lessonId: { userId, lessonId } },
          data,
          select: progressSelect,
        }),
      history(userId: string, skip: number, take: number) {
        return db.lessonProgress.findMany({
          where: { userId, lesson: { status: 'PUBLISHED' } },
          orderBy: [{ lastViewedAt: 'desc' }, { id: 'asc' }],
          select: {
            ...progressSelect,
            lesson: {
              select: {
                id: true,
                title: true,
                contentType: true,
                chapter: {
                  select: {
                    title: true,
                    module: { select: { title: true, course: { select: courseRefSelect } } },
                  },
                },
              },
            },
          },
          skip,
          take,
        });
      },
      historyCount: (userId: string) =>
        db.lessonProgress.count({ where: { userId, lesson: { status: 'PUBLISHED' } } }),
      /** Completed, still-published lessons of the given courses. */
      completedInCourses: (userId: string, courseIds: string[]) =>
        courseIds.length === 0
          ? Promise.resolve([])
          : db.lessonProgress.findMany({
              where: {
                userId,
                completedAt: { not: null },
                lesson: {
                  status: 'PUBLISHED',
                  chapter: { module: { courseId: { in: courseIds } } },
                },
              },
              select: { lessonId: true, completedAt: true },
            }),
    },

    lessons: {
      findWithOwner: (id: string) =>
        db.lesson.findUnique({ where: { id }, select: lessonWithOwnerSelect }),
      /** Lesson type + course only, for write endpoints. */
      findOwner: (id: string) =>
        db.lesson.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            contentType: true,
            durationSeconds: true,
            chapter: { select: { module: { select: { courseId: true } } } },
          },
        }),
      /** Published lessons of one kind in the given courses, in course/curriculum order. */
      listByType(
        courseIds: string[],
        contentType: Prisma.LessonWhereInput['contentType'],
        skip: number,
        take: number,
      ) {
        const where: Prisma.LessonWhereInput = {
          status: 'PUBLISHED',
          contentType,
          chapter: { module: { courseId: { in: courseIds } } },
        };
        return Promise.all([
          db.lesson.findMany({
            where,
            orderBy: [
              { chapter: { module: { course: { title: 'asc' } } } },
              { chapter: { module: { position: 'asc' } } },
              { chapter: { position: 'asc' } },
              { position: 'asc' },
            ],
            select: {
              id: true,
              title: true,
              contentType: true,
              durationSeconds: true,
              chapter: {
                select: {
                  title: true,
                  module: { select: { title: true, course: { select: courseRefSelect } } },
                },
              },
            },
            skip,
            take,
          }),
          db.lesson.count({ where }),
        ]);
      },
    },

    student: {
      profile: (userId: string) =>
        db.user.findUnique({
          where: { id: userId },
          select: {
            fullName: true,
            email: true,
            phone: true,
            emailVerifiedAt: true,
            createdAt: true,
            studentProfile: {
              select: {
                studentCode: true,
                class: { select: { name: true, slug: true, academicLevel: publicRef } },
                stream: { select: { name: true, slug: true, academicLevel: publicRef } },
              },
            },
          },
        }),
      updateUser: (userId: string, data: { fullName?: string; phone?: string | null }) =>
        db.user.update({ where: { id: userId }, data, select: { id: true } }),
    },
  };
}

export type StudentRepository = ReturnType<typeof createStudentRepository>;
