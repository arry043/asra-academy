import { PERMISSIONS, type LiveClassDto, type Paginated } from '@asra/types';
import {
  safeExternalUrlSchema,
  type LiveClassCreateInput,
  type LiveClassListQuery,
  type LiveClassUpdateInput,
  type StudentLiveClassQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { withoutUndefined } from '../../utils/object.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { createStudentRepository } from '../student/student.repository.js';

/**
 * Live-class scheduling (PHASE 08, docs/FACULTY-PORTAL.md §6). Provider-neutral: no meeting is
 * created through a provider API because none is configured (F-01). A faculty member may paste a
 * meeting link they created in their own tool (`provider = 'manual'`); the platform never invents
 * one. Links are returned only to the course's faculty and to students with access to the course,
 * and never by public endpoints.
 *
 * Times are stored in UTC; requests carry an explicit offset (the portal sends IST, V-09).
 * "Upcoming" = a SCHEDULED or CANCELLED class that has not ended (start + duration > now); "past"
 * = ended. Nothing is ever reported as "live" — no provider confirms that a class is running.
 */

/** Max scheduling horizon. */
const MAX_DAYS_AHEAD = 366;
const MANUAL_PROVIDER = 'manual';

const notFound = (entity: string): never => {
  throw new AppError('NOT_FOUND', `${entity} not found`);
};

const sessionSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  startsAt: true,
  durationMinutes: true,
  status: true,
  provider: true,
  joinUrl: true,
  cancelledAt: true,
  updatedAt: true,
  course: { select: { id: true, title: true } },
  host: { select: { user: { select: { fullName: true } } } },
} satisfies Prisma.LiveClassSessionSelect;

type SessionRow = Prisma.LiveClassSessionGetPayload<{ select: typeof sessionSelect }>;

const endOf = (row: { startsAt: Date; durationMinutes: number }) =>
  new Date(row.startsAt.getTime() + row.durationMinutes * 60_000);

function toDto(row: SessionRow, { includeLink }: { includeLink: boolean }): LiveClassDto {
  // Re-validated on the way out; cancelled classes never expose a link.
  const link =
    includeLink && row.status === 'SCHEDULED' && row.joinUrl
      ? safeExternalUrlSchema.safeParse(row.joinUrl)
      : null;
  return {
    id: row.id,
    course: row.course,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: endOf(row).toISOString(),
    durationMinutes: row.durationMinutes,
    status: row.status,
    provider: row.provider,
    joinUrl: link?.success ? link.data : null,
    host: row.host?.user.fullName ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertStartsAt(startsAt: string): Date {
  const date = new Date(startsAt);
  const now = Date.now();
  if (date.getTime() <= now) {
    throw fieldError('VALIDATION_ERROR', 'startsAt', 'Choose a start time in the future');
  }
  if (date.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
    throw fieldError('VALIDATION_ERROR', 'startsAt', 'Classes can be scheduled up to a year ahead');
  }
  return date;
}

/**
 * One page of session ids in a time window (the end time is derived, so this is SQL), ordered
 * soonest-first for upcoming and most-recent-first for past classes.
 */
async function pageIds(
  courseIds: string[],
  when: 'upcoming' | 'past',
  skip: number,
  take: number,
  db: DbClient = prisma,
): Promise<{ ids: string[]; total: number }> {
  if (courseIds.length === 0) return { ids: [], total: 0 };
  const rows =
    when === 'upcoming'
      ? await db.$queryRaw<{ id: string; total: number }[]>`
          SELECT "id", count(*) OVER ()::int AS "total" FROM "live_class_sessions"
          WHERE "course_id" = ANY(${courseIds}::uuid[])
            AND "starts_at" + make_interval(mins => "duration_minutes") > now()
          ORDER BY "starts_at" ASC, "id" ASC OFFSET ${skip} LIMIT ${take}`
      : await db.$queryRaw<{ id: string; total: number }[]>`
          SELECT "id", count(*) OVER ()::int AS "total" FROM "live_class_sessions"
          WHERE "course_id" = ANY(${courseIds}::uuid[])
            AND "starts_at" + make_interval(mins => "duration_minutes") <= now()
          ORDER BY "starts_at" DESC, "id" ASC OFFSET ${skip} LIMIT ${take}`;
  if (rows.length > 0) return { ids: rows.map((row) => row.id), total: rows[0]!.total };
  // An out-of-range page returns no rows (and so no window count): count separately.
  const [count] =
    when === 'upcoming'
      ? await db.$queryRaw<{ total: number }[]>`
          SELECT count(*)::int AS "total" FROM "live_class_sessions"
          WHERE "course_id" = ANY(${courseIds}::uuid[])
            AND "starts_at" + make_interval(mins => "duration_minutes") > now()`
      : await db.$queryRaw<{ total: number }[]>`
          SELECT count(*)::int AS "total" FROM "live_class_sessions"
          WHERE "course_id" = ANY(${courseIds}::uuid[])
            AND "starts_at" + make_interval(mins => "duration_minutes") <= now()`;
  return { ids: [], total: count?.total ?? 0 };
}

async function loadInOrder(ids: string[]): Promise<SessionRow[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.liveClassSession.findMany({
    where: { id: { in: ids } },
    select: sessionSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

async function requireManagedSession(auth: AuthContext, id: string, db: DbClient = prisma) {
  const row =
    (await db.liveClassSession.findUnique({ where: { id }, select: sessionSelect })) ??
    notFound('Live class');
  await accessPolicy.assertTeachesCourse(
    auth,
    row.courseId,
    PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED,
    db,
  );
  return row;
}

async function lockSession(tx: DbClient, id: string): Promise<SessionRow> {
  await tx.$queryRaw`SELECT "id" FROM "live_class_sessions" WHERE "id" = ${id}::uuid FOR UPDATE`;
  return tx.liveClassSession.findUniqueOrThrow({ where: { id }, select: sessionSelect });
}

function assertEditable(row: SessionRow) {
  if (row.status === 'CANCELLED') {
    throw new AppError('CONFLICT', 'This class was cancelled and can no longer be changed.');
  }
  if (endOf(row).getTime() <= Date.now()) {
    throw new AppError('CONFLICT', 'This class has already ended and can no longer be changed.');
  }
}

export const liveClassService = {
  async list(auth: AuthContext, query: LiveClassListQuery): Promise<Paginated<LiveClassDto>> {
    let ids = await accessPolicy.taughtCourseIds(auth, PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED);
    if (query.courseId) {
      if (!ids.includes(query.courseId)) {
        throw new AppError('FORBIDDEN', 'You are not assigned to this course');
      }
      ids = [query.courseId];
    }
    const { skip, take } = pageArgs(query);
    const page = await pageIds(ids, query.when, skip, take);
    const rows = await loadInOrder(page.ids);
    return paginated(
      rows.map((row) => toDto(row, { includeLink: true })),
      page.total,
      query,
    );
  },

  /** Next classes of already-authorised courses (dashboard). */
  async upcomingFor(courseIds: string[], take: number): Promise<LiveClassDto[]> {
    const page = await pageIds(courseIds, 'upcoming', 0, take);
    return (await loadInOrder(page.ids)).map((row) => toDto(row, { includeLink: true }));
  },

  async create(
    auth: AuthContext,
    courseId: string,
    input: LiveClassCreateInput,
  ): Promise<LiveClassDto> {
    const course =
      (await prisma.course.findUnique({ where: { id: courseId }, select: { status: true } })) ??
      notFound('Course');
    await accessPolicy.assertTeachesCourse(
      auth,
      courseId,
      PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED,
    );
    if (course.status === 'ARCHIVED') {
      throw new AppError('CONFLICT', 'Classes cannot be scheduled for an archived course.');
    }
    const startsAt = assertStartsAt(input.startsAt);
    const host = await prisma.facultyProfile.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    const row = await prisma.liveClassSession.create({
      data: {
        courseId,
        hostFacultyProfileId: host?.id ?? null,
        title: input.title,
        description: input.description ?? null,
        startsAt,
        durationMinutes: input.durationMinutes,
        provider: input.joinUrl ? MANUAL_PROVIDER : null,
        joinUrl: input.joinUrl ?? null,
        createdById: auth.userId,
      },
      select: sessionSelect,
    });
    return toDto(row, { includeLink: true });
  },

  async update(auth: AuthContext, id: string, input: LiveClassUpdateInput): Promise<LiveClassDto> {
    return prisma.$transaction(async (tx) => {
      await requireManagedSession(auth, id, tx);
      const current = await lockSession(tx, id);
      assertEditable(current);
      const { startsAt, joinUrl, ...fields } = input;
      const data: Prisma.LiveClassSessionUncheckedUpdateInput = withoutUndefined(fields);
      if (startsAt !== undefined && new Date(startsAt).getTime() !== current.startsAt.getTime()) {
        data.startsAt = assertStartsAt(startsAt);
      }
      if (joinUrl !== undefined) {
        data.joinUrl = joinUrl;
        data.provider = joinUrl ? MANUAL_PROVIDER : null;
      }
      const row = await tx.liveClassSession.update({ where: { id }, data, select: sessionSelect });
      return toDto(row, { includeLink: true });
    });
  },

  /** Idempotent; an ended class cannot be cancelled after the fact. */
  async cancel(
    auth: AuthContext,
    id: string,
  ): Promise<{ cancelled: boolean; liveClass: LiveClassDto }> {
    return prisma.$transaction(async (tx) => {
      await requireManagedSession(auth, id, tx);
      const current = await lockSession(tx, id);
      if (current.status === 'CANCELLED') {
        return { cancelled: false, liveClass: toDto(current, { includeLink: true }) };
      }
      assertEditable(current);
      const row = await tx.liveClassSession.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        select: sessionSelect,
      });
      return { cancelled: true, liveClass: toDto(row, { includeLink: true }) };
    });
  },

  /** Classes of the courses the student can currently access (ACTIVE + PUBLISHED). */
  async forStudent(
    auth: AuthContext,
    query: StudentLiveClassQuery,
  ): Promise<Paginated<LiveClassDto>> {
    const enrollments = await prisma.enrollment.findMany({
      where: createStudentRepository(prisma).enrollments.accessibleWhere(auth.userId),
      select: { courseId: true },
    });
    const { skip, take } = pageArgs(query);
    const page = await pageIds(
      enrollments.map((row) => row.courseId),
      query.when,
      skip,
      take,
    );
    const rows = await loadInOrder(page.ids);
    const now = Date.now();
    return paginated(
      // Students get the link only until the class ends.
      rows.map((row) => toDto(row, { includeLink: endOf(row).getTime() > now })),
      page.total,
      query,
    );
  },
};
