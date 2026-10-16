import type {
  CourseProgressDto,
  FacultyCourseCard,
  FacultyCourseRef,
  StudentWorkSummary,
} from '@asra/types';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { calculateCourseProgress } from '../student/progress.js';
import { toCourseRef, toCourseView, type CourseView } from '../student/student.mappers.js';
import { courseRefSelect, createStudentRepository } from '../student/student.repository.js';

/**
 * Bulk read helpers for the faculty portal (PHASE 08). Every function takes course ids that the
 * caller has ALREADY authorised (from `accessPolicy`), and answers with a fixed number of queries
 * whatever the page size — no per-row queries (N+1).
 */

export const facultyCourseSelect = {
  ...courseRefSelect,
  status: true,
  visibility: true,
  updatedAt: true,
} satisfies Prisma.CourseSelect;

export type FacultyCourseRow = Prisma.CourseGetPayload<{ select: typeof facultyCourseSelect }>;

export function toFacultyCourseRef(row: FacultyCourseRow): FacultyCourseRef {
  return { ...toCourseRef(row), status: row.status, visibility: row.visibility };
}

/** Floored percentage, or null when there is nothing to divide by. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.floor((part * 100) / whole) : null;
}

interface CourseCounts {
  courseId: string;
  activeStudents: number;
  publishedLessons: number;
  draftLessons: number;
  assignments: number;
  quizLessons: number;
  pendingReviews: number;
  gradedUnreleased: number;
  upcomingClasses: number;
}

/**
 * Per-course counters in ONE query. "Upcoming" classes are SCHEDULED classes that have not ended
 * yet (start + duration in the future) — a class is never reported as "live".
 */
export async function courseCounts(
  courseIds: string[],
  db: DbClient = prisma,
): Promise<Map<string, CourseCounts>> {
  if (courseIds.length === 0) return new Map();
  const lessonsOf = Prisma.sql`
    FROM "lessons" l
    JOIN "chapters" ch ON ch."id" = l."chapter_id"
    JOIN "modules" m ON m."id" = ch."module_id"
    WHERE m."course_id" = c."id"`;
  const submissionsOf = Prisma.sql`
    FROM "assignment_submissions" s
    JOIN "assignments" a ON a."id" = s."assignment_id"
    JOIN "lessons" l ON l."id" = a."lesson_id"
    JOIN "chapters" ch ON ch."id" = l."chapter_id"
    JOIN "modules" m ON m."id" = ch."module_id"
    WHERE m."course_id" = c."id"`;
  const rows = await db.$queryRaw<CourseCounts[]>`
    SELECT c."id" AS "courseId",
      (SELECT count(*)::int FROM "enrollments" e
        WHERE e."course_id" = c."id" AND e."status" = 'ACTIVE') AS "activeStudents",
      (SELECT count(*)::int ${lessonsOf} AND l."status" = 'PUBLISHED') AS "publishedLessons",
      (SELECT count(*)::int ${lessonsOf} AND l."status" <> 'PUBLISHED') AS "draftLessons",
      (SELECT count(*)::int ${lessonsOf} AND l."content_type" = 'ASSIGNMENT') AS "assignments",
      (SELECT count(*)::int ${lessonsOf} AND l."content_type" = 'QUIZ') AS "quizLessons",
      (SELECT count(*)::int ${submissionsOf} AND s."status" = 'SUBMITTED') AS "pendingReviews",
      (SELECT count(*)::int ${submissionsOf}
        AND s."status" = 'GRADED' AND s."result_released_at" IS NULL) AS "gradedUnreleased",
      (SELECT count(*)::int FROM "live_class_sessions" lc
        WHERE lc."course_id" = c."id" AND lc."status" = 'SCHEDULED'
          AND lc."starts_at" + make_interval(mins => lc."duration_minutes") > now()) AS "upcomingClasses"
    FROM "courses" c
    WHERE c."id" = ANY(${courseIds}::uuid[])`;
  return new Map(rows.map((row) => [row.courseId, row]));
}

/** Course cards for already-authorised courses, in the order of `rows`. */
export async function toCourseCards(
  userId: string,
  rows: FacultyCourseRow[],
): Promise<FacultyCourseCard[]> {
  const ids = rows.map((row) => row.id);
  const [counts, primary] = await Promise.all([
    courseCounts(ids),
    prisma.courseInstructor.findMany({
      where: { courseId: { in: ids }, isPrimary: true, facultyProfile: { userId } },
      select: { courseId: true },
    }),
  ]);
  const primaryIds = new Set(primary.map((row) => row.courseId));
  return rows.map((row) => {
    const count = counts.get(row.id);
    return {
      ...toFacultyCourseRef(row),
      isPrimary: primaryIds.has(row.id),
      activeStudents: count?.activeStudents ?? 0,
      lessons: { published: count?.publishedLessons ?? 0, draft: count?.draftLessons ?? 0 },
      assignments: count?.assignments ?? 0,
      pendingReviews: count?.pendingReviews ?? 0,
      upcomingClasses: count?.upcomingClasses ?? 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export interface EnrollmentKey {
  userId: string;
  courseId: string;
  completedAt: Date | null;
}

/**
 * Lesson-completion progress of many (student, course) pairs with the SAME rules as the student
 * portal (docs/STUDENT-LMS.md §4): two queries in total.
 */
export async function progressFor(
  keys: EnrollmentKey[],
): Promise<{ progress: CourseProgressDto[]; views: Map<string, CourseView> }> {
  const courseIds = [...new Set(keys.map((key) => key.courseId))];
  const structures = await createStudentRepository(prisma).structures(courseIds);
  const views = new Map(courseIds.map((id) => [id, toCourseView(structures.get(id))]));
  const eligible = [...views.values()].flatMap((view) => view.eligibleIds);
  const userIds = [...new Set(keys.map((key) => key.userId))];
  const completed =
    eligible.length === 0 || userIds.length === 0
      ? []
      : await prisma.lessonProgress.findMany({
          where: {
            userId: { in: userIds },
            lessonId: { in: eligible },
            completedAt: { not: null },
          },
          select: { userId: true, lessonId: true },
        });
  const byUser = new Map<string, Set<string>>();
  for (const row of completed) {
    const set = byUser.get(row.userId) ?? new Set<string>();
    set.add(row.lessonId);
    byUser.set(row.userId, set);
  }
  return {
    views,
    progress: keys.map((key) =>
      calculateCourseProgress(
        views.get(key.courseId)?.eligibleIds ?? [],
        byUser.get(key.userId) ?? new Set(),
        key.completedAt,
      ),
    ),
  };
}

/** Published assignments (with settings) of the given courses: id → { courseId, maxMarks }. */
export async function publishedAssignments(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, { courseId: string; maxMarks: number }>();
  const rows = await prisma.assignment.findMany({
    where: {
      lesson: { status: 'PUBLISHED', chapter: { module: { courseId: { in: courseIds } } } },
    },
    select: {
      id: true,
      maxMarks: true,
      lesson: { select: { chapter: { select: { module: { select: { courseId: true } } } } } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      { courseId: row.lesson.chapter.module.courseId, maxMarks: row.maxMarks },
    ]),
  );
}

const emptyWork = (assignments: number): StudentWorkSummary => ({
  assignments,
  submitted: 0,
  graded: 0,
  released: 0,
  releasedScorePercent: null,
});

/**
 * Assignment work per (student, course): published assignments, submissions, graded and released
 * counts and the released score (released marks ÷ their maximum). Two queries in total.
 */
export async function workFor(keys: { userId: string; courseId: string }[]) {
  const courseIds = [...new Set(keys.map((key) => key.courseId))];
  const assignments = await publishedAssignments(courseIds);
  const perCourse = new Map<string, number>();
  for (const { courseId } of assignments.values()) {
    perCourse.set(courseId, (perCourse.get(courseId) ?? 0) + 1);
  }
  const userIds = [...new Set(keys.map((key) => key.userId))];
  const submissions =
    assignments.size === 0 || userIds.length === 0
      ? []
      : await prisma.assignmentSubmission.findMany({
          where: { userId: { in: userIds }, assignmentId: { in: [...assignments.keys()] } },
          select: {
            userId: true,
            assignmentId: true,
            status: true,
            marksAwarded: true,
            resultReleasedAt: true,
          },
        });
  const tally = new Map<string, StudentWorkSummary & { marks: number; max: number }>();
  for (const row of submissions) {
    const assignment = assignments.get(row.assignmentId)!;
    const key = `${row.userId}:${assignment.courseId}`;
    const entry = tally.get(key) ?? {
      ...emptyWork(perCourse.get(assignment.courseId) ?? 0),
      marks: 0,
      max: 0,
    };
    entry.submitted += 1;
    if (row.status === 'GRADED') entry.graded += 1;
    if (row.resultReleasedAt !== null && row.marksAwarded !== null) {
      entry.released += 1;
      entry.marks += row.marksAwarded;
      entry.max += assignment.maxMarks;
    }
    tally.set(key, entry);
  }
  return keys.map((key): StudentWorkSummary => {
    const entry = tally.get(`${key.userId}:${key.courseId}`);
    if (!entry) return emptyWork(perCourse.get(key.courseId) ?? 0);
    const { marks, max, ...summary } = entry;
    return { ...summary, releasedScorePercent: percentOf(marks, max) };
  });
}
