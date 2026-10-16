import type { AdminEnrollmentDto, Paginated } from '@asra/types';
import type { AdminEnrollmentCreateInput, AdminEnrollmentListQuery } from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { calculateCourseProgress } from '../student/progress.js';
import { toCourseView } from '../student/student.mappers.js';
import { createStudentRepository } from '../student/student.repository.js';

/**
 * Manual enrolment by administrators (`enrollments.manage`, docs/STUDENT-LMS.md §2.3).
 *
 * This is the only way into a paid or unpriced course until verified online payments exist
 * (PHASE 10) — e.g. an offline payment or scholarship recorded by the academy (M-07). It never
 * creates or implies a payment record. Every row names the administrator who enrolled the student.
 */

const adminEnrollmentSelect = {
  id: true,
  courseId: true,
  status: true,
  source: true,
  enrolledAt: true,
  cancelledAt: true,
  completedAt: true,
  lastActivityAt: true,
  user: { select: { id: true, fullName: true, email: true } },
  enrolledBy: { select: { fullName: true } },
} satisfies Prisma.EnrollmentSelect;

type AdminEnrollmentRow = Prisma.EnrollmentGetPayload<{ select: typeof adminEnrollmentSelect }>;

const courseNotFound = (): never => {
  throw new AppError('NOT_FOUND', 'Course not found');
};

/** Rows + progress for one course: two progress queries for the whole page. */
async function toDtos(courseId: string, rows: AdminEnrollmentRow[]): Promise<AdminEnrollmentDto[]> {
  const repo = createStudentRepository(prisma);
  const view = toCourseView((await repo.structures([courseId])).get(courseId));
  const completed = await prisma.lessonProgress.findMany({
    where: {
      userId: { in: rows.map((row) => row.user.id) },
      completedAt: { not: null },
      lessonId: { in: view.eligibleIds },
    },
    select: { userId: true, lessonId: true },
  });
  const byUser = new Map<string, Set<string>>();
  for (const row of completed) {
    const set = byUser.get(row.userId) ?? new Set<string>();
    set.add(row.lessonId);
    byUser.set(row.userId, set);
  }
  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    student: { userId: row.user.id, fullName: row.user.fullName, email: row.user.email },
    status: row.status,
    source: row.source,
    enrolledBy: row.enrolledBy?.fullName ?? null,
    enrolledAt: row.enrolledAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    progress: calculateCourseProgress(
      view.eligibleIds,
      byUser.get(row.user.id) ?? new Set(),
      row.completedAt,
    ),
  }));
}

export const enrollmentsService = {
  async list(
    courseId: string,
    query: AdminEnrollmentListQuery,
  ): Promise<Paginated<AdminEnrollmentDto>> {
    if (!(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
      courseNotFound();
    }
    const where: Prisma.EnrollmentWhereInput = {
      courseId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            user: {
              OR: [
                { fullName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        select: adminEnrollmentSelect,
        orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.enrollment.count({ where }),
    ]);
    return paginated(await toDtos(courseId, rows), total, query);
  },

  /**
   * Enrols the STUDENT account with this email. Archived courses are refused; drafts are allowed
   * (access still starts only when the course is published). A cancelled enrolment is reactivated
   * in place, keeping the student's progress history.
   */
  async enroll(
    auth: AuthContext,
    courseId: string,
    input: AdminEnrollmentCreateInput,
  ): Promise<AdminEnrollmentDto> {
    const id = await prisma.$transaction(async (tx) => {
      const repo = createStudentRepository(tx);
      if (!(await repo.course.lock(courseId))) courseNotFound();
      const course = (await repo.course.findForAccess(courseId))!;
      if (course.status === 'ARCHIVED') {
        throw new AppError('CONFLICT', 'Archived courses cannot take new enrolments.');
      }

      const student = await tx.user.findFirst({
        where: { email: input.email, roles: { some: { role: { key: 'STUDENT' } } } },
        select: { id: true },
      });
      if (!student) {
        throw fieldError('VALIDATION_ERROR', 'email', 'No student account uses this email.');
      }

      const existing = await repo.enrollments.find(student.id, courseId);
      if (existing?.status === 'ACTIVE') {
        throw fieldError('CONFLICT', 'email', 'This student is already enrolled.');
      }
      const now = new Date();
      if (existing) {
        await tx.enrollment.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            source: 'ADMIN',
            enrolledById: auth.userId,
            enrolledAt: now,
            cancelledAt: null,
          },
        });
        return existing.id;
      }
      const created = await tx.enrollment.create({
        data: {
          userId: student.id,
          courseId,
          status: 'ACTIVE',
          source: 'ADMIN',
          enrolledById: auth.userId,
          enrolledAt: now,
        },
        select: { id: true },
      });
      return created.id;
    });
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { id },
      select: adminEnrollmentSelect,
    });
    return (await toDtos(courseId, [row]))[0]!;
  },

  /** Cancels access immediately. Progress records are kept for history. */
  async cancel(id: string): Promise<AdminEnrollmentDto> {
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "enrollments" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new AppError('NOT_FOUND', 'Enrolment not found');
      const current = await tx.enrollment.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (current.status === 'CANCELLED') {
        throw new AppError('CONFLICT', 'This enrolment is already cancelled.');
      }
      return tx.enrollment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        select: adminEnrollmentSelect,
      });
    });
    return (await toDtos(updated.courseId, [updated]))[0]!;
  },
};
