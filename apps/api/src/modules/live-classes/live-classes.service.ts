import {
  PERMISSIONS,
  type LiveClassDto,
  type LiveClassMeetingState,
  type LiveClassProvider,
  type LiveClassSettingsDto,
  type Paginated,
} from '@asra/types';
import {
  DEFAULT_LIVE_CLASS_TIME_ZONE,
  LIVE_CLASS_TIME_ZONES,
  safeExternalUrlSchema,
  type AdminLiveClassCreateInput,
  type AdminLiveClassListQuery,
  type AdminLiveClassUpdateInput,
  type LiveClassCreateInput,
  type LiveClassListQuery,
  type LiveClassRecordingInput,
  type LiveClassUpdateInput,
  type StudentLiveClassQuery,
} from '@asra/validation';
import { MEETING_CLAIM_LEASE_MS } from '../../config/constants.js';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import { Prisma, type LiveClassStatus } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { dispatchAfterCommit } from '../notifications/dispatcher.js';
import { liveClassEvents, type LiveClassFacts } from '../notifications/events.js';
import { eligibleStudentIds, notifyUsers } from '../notifications/notifications.service.js';
import { createStudentRepository } from '../student/student.repository.js';
import { googleMeetProvider } from './providers/google-meet.provider.js';
import { MeetingProviderError } from './providers/meeting-provider.js';

/**
 * Live classes (PHASE 08 scheduling; PHASE 11 admin management, Google Meet, recordings and
 * notifications — docs/LIVE-CLASSES.md).
 *
 * Who may manage a class:
 *   - administrators with `live_classes.manage` — any course; they choose the host faculty;
 *   - faculty with `live_classes.manage_assigned` — only courses they are assigned to.
 * Students only read classes of courses they can currently access (ACTIVE + PUBLISHED).
 *
 * Lifecycle: SCHEDULED → CANCELLED (before it ends) | COMPLETED (once it has started). Nothing is
 * reported as "live": no provider confirms that a class is running.
 *
 * Times are UTC instants; requests carry an explicit offset and the class keeps its IANA zone
 * (V-09: Asia/Kolkata). "Upcoming" = not yet ended (start + duration > now); "past" = ended.
 *
 * Meeting links: `manual` (pasted by staff) or `google_meet` (created through the provider
 * port). A Google Meet space is created at most once per class: one process CLAIMS the class
 * (`meeting_claimed_at`, leased) before calling Google, and the provider id is unique.
 *
 * Notifications are written in the same transaction as the change and emailed after commit.
 */

/** Max scheduling horizon. */
const MAX_DAYS_AHEAD = 366;
const MANUAL: LiveClassProvider = 'manual';
const GOOGLE_MEET: LiveClassProvider = 'google_meet';

type Scope = 'admin' | 'faculty';

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
  timeZone: true,
  status: true,
  provider: true,
  joinUrl: true,
  providerMeetingId: true,
  meetingClaimedAt: true,
  meetingLastError: true,
  hostFacultyProfileId: true,
  recordingUrl: true,
  recordingUpdatedAt: true,
  cancelledAt: true,
  completedAt: true,
  updatedAt: true,
  course: { select: { id: true, title: true, status: true } },
  host: { select: { userId: true, user: { select: { fullName: true } } } },
} satisfies Prisma.LiveClassSessionSelect;

type SessionRow = Prisma.LiveClassSessionGetPayload<{ select: typeof sessionSelect }>;

const endOf = (row: { startsAt: Date; durationMinutes: number }) =>
  new Date(row.startsAt.getTime() + row.durationMinutes * 60_000);

const hasEnded = (row: { startsAt: Date; durationMinutes: number }) =>
  endOf(row).getTime() <= clock.now().getTime();

const hasStarted = (row: { startsAt: Date }) => row.startsAt.getTime() <= clock.now().getTime();

function meetingState(row: SessionRow): { state: LiveClassMeetingState; error: string | null } {
  if (row.joinUrl) return { state: 'READY', error: null };
  if (row.provider !== GOOGLE_MEET) return { state: 'NONE', error: null };
  const claimLive =
    row.meetingClaimedAt &&
    row.meetingClaimedAt.getTime() > clock.now().getTime() - MEETING_CLAIM_LEASE_MS;
  if (claimLive) return { state: 'PENDING', error: null };
  return {
    state: 'FAILED',
    error: row.meetingLastError ?? 'The Google Meet link was not created. Try again.',
  };
}

type Viewer = 'staff' | 'student';

function toDto(row: SessionRow, viewer: Viewer): LiveClassDto {
  const ended = hasEnded(row);
  // Re-validated on the way out. Only a SCHEDULED class has a joinable link; students lose it
  // when the class ends, staff keep seeing it for reference.
  const linkVisible = row.status === 'SCHEDULED' && (viewer === 'staff' || !ended);
  const link = linkVisible && row.joinUrl ? safeExternalUrlSchema.safeParse(row.joinUrl) : null;
  // A recording is shown only for a class that was held (not cancelled).
  const recording =
    row.recordingUrl && row.status !== 'CANCELLED'
      ? safeExternalUrlSchema.safeParse(row.recordingUrl)
      : null;
  const meeting = meetingState(row);
  return {
    id: row.id,
    course: { id: row.course.id, title: row.course.title },
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: endOf(row).toISOString(),
    durationMinutes: row.durationMinutes,
    timeZone: row.timeZone,
    status: row.status,
    provider: (row.provider as LiveClassProvider | null) ?? null,
    meetingState: meeting.state,
    meetingError: viewer === 'staff' ? meeting.error : null,
    joinUrl: link?.success ? link.data : null,
    host: row.host?.user.fullName ?? null,
    hostFacultyProfileId: viewer === 'staff' ? row.hostFacultyProfileId : null,
    recordingUrl: recording?.success ? recording.data : null,
    recordingUpdatedAt: recording?.success ? (row.recordingUpdatedAt?.toISOString() ?? null) : null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function facts(row: SessionRow): LiveClassFacts {
  return {
    id: row.id,
    title: row.title,
    courseTitle: row.course.title,
    host: row.host?.user.fullName ?? null,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    timeZone: row.timeZone,
  };
}

function assertStartsAt(startsAt: string): Date {
  const date = new Date(startsAt);
  const now = clock.now().getTime();
  if (date.getTime() <= now) {
    throw fieldError('VALIDATION_ERROR', 'startsAt', 'Choose a start time in the future');
  }
  if (date.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
    throw fieldError('VALIDATION_ERROR', 'startsAt', 'Classes can be scheduled up to a year ahead');
  }
  return date;
}

// --- Listing ---------------------------------------------------------------------------------

interface PageFilter {
  /** null = every course (administrators). */
  courseIds: string[] | null;
  when: 'upcoming' | 'past';
  status?: LiveClassStatus | undefined;
}

/**
 * One page of session ids in a time window (the end time is derived, so this is SQL), ordered
 * soonest-first for upcoming and most-recent-first for past classes.
 */
async function pageIds(
  filter: PageFilter,
  skip: number,
  take: number,
  db: DbClient = prisma,
): Promise<{ ids: string[]; total: number }> {
  if (filter.courseIds !== null && filter.courseIds.length === 0) return { ids: [], total: 0 };
  const conditions: Prisma.Sql[] = [
    filter.when === 'upcoming'
      ? Prisma.sql`"starts_at" + make_interval(mins => "duration_minutes") > ${clock.now()}`
      : Prisma.sql`"starts_at" + make_interval(mins => "duration_minutes") <= ${clock.now()}`,
  ];
  if (filter.courseIds) conditions.push(Prisma.sql`"course_id" = ANY(${filter.courseIds}::uuid[])`);
  if (filter.status) conditions.push(Prisma.sql`"status"::text = ${filter.status}`);
  const where = Prisma.join(conditions, ' AND ');
  const order =
    filter.when === 'upcoming'
      ? Prisma.sql`"starts_at" ASC, "id" ASC`
      : Prisma.sql`"starts_at" DESC, "id" ASC`;
  const rows = await db.$queryRaw<{ id: string; total: number }[]>`
    SELECT "id", count(*) OVER ()::int AS "total" FROM "live_class_sessions"
    WHERE ${where} ORDER BY ${order} OFFSET ${skip} LIMIT ${take}`;
  if (rows.length > 0) return { ids: rows.map((row) => row.id), total: rows[0]!.total };
  // An out-of-range page returns no rows (and so no window count): count separately.
  const [count] = await db.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS "total" FROM "live_class_sessions" WHERE ${where}`;
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

// --- Authorization ---------------------------------------------------------------------------

/** Course-level check for the actor's scope. */
async function assertCanManageCourse(
  auth: AuthContext,
  scope: Scope,
  courseId: string,
  db: DbClient = prisma,
) {
  if (scope === 'admin') {
    accessPolicy.assertPermission(auth, PERMISSIONS.LIVE_CLASSES_MANAGE);
    return;
  }
  await accessPolicy.assertTeachesCourse(
    auth,
    courseId,
    PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED,
    db,
  );
}

/** Loads a class and checks the caller may manage it (the course comes from the database). */
async function requireManaged(auth: AuthContext, scope: Scope, id: string, db: DbClient = prisma) {
  const row =
    (await db.liveClassSession.findUnique({ where: { id }, select: sessionSelect })) ??
    notFound('Live class');
  await assertCanManageCourse(auth, scope, row.courseId, db);
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
  if (row.status === 'COMPLETED') {
    throw new AppError(
      'CONFLICT',
      'This class is marked as completed and can no longer be changed.',
    );
  }
  if (hasEnded(row)) {
    throw new AppError('CONFLICT', 'This class has already ended and can no longer be changed.');
  }
}

/** The host must be a faculty member assigned to the course (an admin cannot pick anyone else). */
async function assertHostTeaches(db: DbClient, courseId: string, facultyProfileId: string) {
  const assigned = await db.courseInstructor.findUnique({
    where: { courseId_facultyProfileId: { courseId, facultyProfileId } },
    select: { facultyProfileId: true },
  });
  if (!assigned) {
    throw fieldError(
      'VALIDATION_ERROR',
      'hostFacultyProfileId',
      'Choose a faculty member assigned to this course',
    );
  }
}

function assertGoogleMeetConfigured() {
  if (!googleMeetProvider().configured) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'Automatic Google Meet links are not set up on this server. Paste a meeting link instead, or ask the administrator to configure Google Meet.',
    );
  }
}

// --- Notifications ---------------------------------------------------------------------------

/**
 * Students who can access the course, plus the host faculty member when someone else made the
 * change (an administrator scheduling for them). Returns delivery ids to dispatch after commit.
 */
async function notifyAudience(
  tx: DbClient,
  row: SessionRow,
  actorUserId: string,
  build: (audience: 'student' | 'faculty') => Parameters<typeof notifyUsers>[2],
  options: { includeHost?: boolean } = {},
): Promise<string[]> {
  const ids: string[] = [];
  const students = await eligibleStudentIds(tx, row.courseId);
  if (students.length > 0) ids.push(...(await notifyUsers(tx, students, build('student'))));
  const hostUserId = row.host?.userId;
  if ((options.includeHost ?? true) && hostUserId && hostUserId !== actorUserId) {
    ids.push(...(await notifyUsers(tx, [hostUserId], build('faculty'))));
  }
  return ids;
}

// --- Meeting provisioning --------------------------------------------------------------------

type ProvisionResult = 'CREATED' | 'EXISTS';

/**
 * Creates the Google Meet space of a SCHEDULED google_meet class at most once. Only the process
 * that wins the claim calls Google; a concurrent caller gets 409. A failure is recorded on the
 * class (staff see it and can retry) and re-thrown — it is never reported as success.
 */
async function provisionMeeting(id: string): Promise<ProvisionResult> {
  const provider = googleMeetProvider();
  const now = clock.now();
  const claimed = await prisma.liveClassSession.updateMany({
    where: {
      id,
      provider: GOOGLE_MEET,
      providerMeetingId: null,
      joinUrl: null,
      status: 'SCHEDULED',
      OR: [
        { meetingClaimedAt: null },
        { meetingClaimedAt: { lt: new Date(now.getTime() - MEETING_CLAIM_LEASE_MS) } },
      ],
    },
    data: { meetingClaimedAt: now },
  });
  if (claimed.count === 0) {
    const current = await prisma.liveClassSession.findUniqueOrThrow({
      where: { id },
      select: { joinUrl: true, provider: true, status: true },
    });
    if (current.provider === GOOGLE_MEET && current.joinUrl) return 'EXISTS';
    if (current.status !== 'SCHEDULED') {
      throw new AppError('CONFLICT', 'Meeting links can only be created for scheduled classes.');
    }
    throw new AppError(
      'CONFLICT',
      'A Google Meet link is already being created for this class. Refresh in a moment.',
    );
  }
  try {
    const meeting = await provider.createMeeting();
    const saved = await prisma.liveClassSession.updateMany({
      where: { id, meetingClaimedAt: now },
      data: {
        providerMeetingId: meeting.meetingId,
        joinUrl: meeting.joinUrl,
        meetingClaimedAt: null,
        meetingLastError: null,
      },
    });
    if (saved.count === 0) {
      // Our claim was taken over (lease expired mid-call). The other process owns the result;
      // the space we created stays unused (harmless) and is logged for the record.
      logger.warn(
        { liveClassId: id, provider: provider.id },
        'Meeting created after claim expired; not saved',
      );
      return 'EXISTS';
    }
    return 'CREATED';
  } catch (error) {
    const message =
      error instanceof MeetingProviderError
        ? error.message
        : 'The Google Meet link could not be created.';
    await prisma.liveClassSession.updateMany({
      where: { id, meetingClaimedAt: now },
      data: { meetingClaimedAt: null, meetingLastError: message.slice(0, 300) },
    });
    logger.warn(
      {
        liveClassId: id,
        provider: provider.id,
        kind: error instanceof MeetingProviderError ? error.kind : 'UNEXPECTED',
        httpStatus: error instanceof MeetingProviderError ? error.httpStatus : null,
      },
      'Meeting provider call failed',
    );
    if (error instanceof MeetingProviderError) {
      throw new AppError(
        error.kind === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE',
        message,
      );
    }
    throw error;
  }
}

async function reload(id: string): Promise<SessionRow> {
  return prisma.liveClassSession.findUniqueOrThrow({ where: { id }, select: sessionSelect });
}

// --- Shared operations -----------------------------------------------------------------------

interface CreateArgs {
  courseId: string;
  hostFacultyProfileId: string | null;
  input: LiveClassCreateInput;
}

export interface LiveClassCreateResult {
  liveClass: LiveClassDto;
  /** Set when a Google Meet link was requested but could not be created (class still saved). */
  meetingError: string | null;
}

async function createSession(
  auth: AuthContext,
  scope: Scope,
  { courseId, hostFacultyProfileId, input }: CreateArgs,
): Promise<LiveClassCreateResult> {
  const wantsGoogle = input.meeting === 'google_meet';
  // Refuse up front: a class must never look as if a Google link is coming when it cannot.
  if (wantsGoogle) assertGoogleMeetConfigured();
  const startsAt = assertStartsAt(input.startsAt);

  const { id, deliveries } = await prisma.$transaction(async (tx) => {
    const course =
      (await tx.course.findUnique({ where: { id: courseId }, select: { status: true } })) ??
      notFound('Course');
    await assertCanManageCourse(auth, scope, courseId, tx);
    if (course.status === 'ARCHIVED') {
      throw new AppError('CONFLICT', 'Classes cannot be scheduled for an archived course.');
    }
    if (hostFacultyProfileId) await assertHostTeaches(tx, courseId, hostFacultyProfileId);
    const created = await tx.liveClassSession.create({
      data: {
        courseId,
        hostFacultyProfileId,
        title: input.title,
        description: input.description ?? null,
        startsAt,
        durationMinutes: input.durationMinutes,
        timeZone: input.timeZone ?? DEFAULT_LIVE_CLASS_TIME_ZONE,
        provider: wantsGoogle ? GOOGLE_MEET : input.joinUrl ? MANUAL : null,
        joinUrl: wantsGoogle ? null : (input.joinUrl ?? null),
        createdById: auth.userId,
        updatedById: auth.userId,
      },
      select: sessionSelect,
    });
    const deliveries = await notifyAudience(tx, created, auth.userId, (audience) =>
      liveClassEvents.scheduled(facts(created), audience),
    );
    return { id: created.id, deliveries };
  });

  let meetingError: string | null = null;
  if (wantsGoogle) {
    try {
      await provisionMeeting(id);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      meetingError = error.message;
    }
  }
  // After provisioning, so the emails can include the Google Meet link when it was created.
  dispatchAfterCommit(deliveries);
  return { liveClass: toDto(await reload(id), 'staff'), meetingError };
}

async function updateSession(
  auth: AuthContext,
  scope: Scope,
  id: string,
  input: LiveClassUpdateInput & { hostFacultyProfileId?: string },
): Promise<LiveClassDto> {
  const { row, deliveries } = await prisma.$transaction(async (tx) => {
    await requireManaged(auth, scope, id, tx);
    const current = await lockSession(tx, id);
    assertEditable(current);
    const { startsAt, joinUrl, hostFacultyProfileId, ...fields } = input;
    const data: Prisma.LiveClassSessionUncheckedUpdateInput = { updatedById: auth.userId };
    if (fields.title !== undefined) data.title = fields.title;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.durationMinutes !== undefined) data.durationMinutes = fields.durationMinutes;
    if (fields.timeZone !== undefined) data.timeZone = fields.timeZone;
    if (startsAt !== undefined && new Date(startsAt).getTime() !== current.startsAt.getTime()) {
      data.startsAt = assertStartsAt(startsAt);
    }
    if (joinUrl !== undefined && joinUrl !== current.joinUrl) {
      // A pasted link replaces whatever was there (including a Google Meet link).
      data.joinUrl = joinUrl;
      data.provider = joinUrl ? MANUAL : null;
      data.providerMeetingId = null;
      data.meetingLastError = null;
      data.meetingClaimedAt = null;
    }
    if (
      hostFacultyProfileId !== undefined &&
      hostFacultyProfileId !== current.hostFacultyProfileId
    ) {
      await assertHostTeaches(tx, current.courseId, hostFacultyProfileId);
      data.hostFacultyProfileId = hostFacultyProfileId;
    }
    const updated = await tx.liveClassSession.update({
      where: { id },
      data,
      select: sessionSelect,
    });

    const scheduleChanged =
      updated.startsAt.getTime() !== current.startsAt.getTime() ||
      updated.durationMinutes !== current.durationMinutes ||
      updated.timeZone !== current.timeZone;
    const linkChanged = updated.joinUrl !== current.joinUrl && updated.joinUrl !== null;
    const deliveries: string[] = [];
    if (scheduleChanged || linkChanged) {
      deliveries.push(
        ...(await notifyAudience(tx, updated, auth.userId, (audience) =>
          liveClassEvents.updated(facts(updated), audience, {
            version: updated.updatedAt,
            scheduleChanged,
          }),
        )),
      );
    }
    if (updated.hostFacultyProfileId !== current.hostFacultyProfileId && updated.host) {
      // The newly assigned host learns about the class like a fresh schedule.
      if (updated.host.userId !== auth.userId) {
        deliveries.push(
          ...(await notifyUsers(
            tx,
            [updated.host.userId],
            liveClassEvents.scheduled(facts(updated), 'faculty'),
          )),
        );
      }
    }
    return { row: updated, deliveries };
  });
  dispatchAfterCommit(deliveries);
  return toDto(row, 'staff');
}

async function cancelSession(
  auth: AuthContext,
  scope: Scope,
  id: string,
): Promise<{ cancelled: boolean; liveClass: LiveClassDto }> {
  const result = await prisma.$transaction(async (tx) => {
    await requireManaged(auth, scope, id, tx);
    const current = await lockSession(tx, id);
    if (current.status === 'CANCELLED') {
      return { cancelled: false, row: current, deliveries: [] as string[] };
    }
    assertEditable(current);
    const row = await tx.liveClassSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: clock.now(),
        updatedById: auth.userId,
        meetingClaimedAt: null,
      },
      select: sessionSelect,
    });
    const deliveries = await notifyAudience(tx, row, auth.userId, (audience) =>
      liveClassEvents.cancelled(facts(row), audience),
    );
    return { cancelled: true, row, deliveries };
  });
  dispatchAfterCommit(result.deliveries);
  return { cancelled: result.cancelled, liveClass: toDto(result.row, 'staff') };
}

/** Confirms the class was held. Allowed once it has started; idempotent. */
async function completeSession(
  auth: AuthContext,
  scope: Scope,
  id: string,
): Promise<{ completed: boolean; liveClass: LiveClassDto }> {
  return prisma.$transaction(async (tx) => {
    await requireManaged(auth, scope, id, tx);
    const current = await lockSession(tx, id);
    if (current.status === 'COMPLETED') {
      return { completed: false, liveClass: toDto(current, 'staff') };
    }
    if (current.status === 'CANCELLED') {
      throw new AppError('CONFLICT', 'A cancelled class cannot be marked as completed.');
    }
    if (!hasStarted(current)) {
      throw new AppError('CONFLICT', 'A class can be marked as completed once it has started.');
    }
    const row = await tx.liveClassSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: clock.now(),
        updatedById: auth.userId,
        meetingClaimedAt: null,
      },
      select: sessionSelect,
    });
    return { completed: true, liveClass: toDto(row, 'staff') };
  });
}

/**
 * Adds, replaces or removes the YouTube recording link (manual workflow, F-04). Allowed once the
 * class has started and unless it was cancelled. Students with access are told in-app.
 */
async function setRecording(
  auth: AuthContext,
  scope: Scope,
  id: string,
  input: LiveClassRecordingInput,
): Promise<LiveClassDto> {
  const { row, deliveries } = await prisma.$transaction(async (tx) => {
    await requireManaged(auth, scope, id, tx);
    const current = await lockSession(tx, id);
    if (current.status === 'CANCELLED') {
      throw new AppError('CONFLICT', 'A cancelled class has no recording.');
    }
    if (!hasStarted(current)) {
      throw new AppError('CONFLICT', 'Add the recording after the class has started.');
    }
    if (input.recordingUrl === current.recordingUrl) {
      return { row: current, deliveries: [] as string[] };
    }
    const now = clock.now();
    const row = await tx.liveClassSession.update({
      where: { id },
      data: {
        recordingUrl: input.recordingUrl,
        recordingUpdatedAt: input.recordingUrl ? now : null,
        updatedById: auth.userId,
      },
      select: sessionSelect,
    });
    const deliveries = input.recordingUrl
      ? await notifyAudience(
          tx,
          row,
          auth.userId,
          () => liveClassEvents.recordingAvailable(facts(row), now),
          { includeHost: false },
        )
      : [];
    return { row, deliveries };
  });
  dispatchAfterCommit(deliveries);
  return toDto(row, 'staff');
}

/**
 * Creates (or retries creating) the Google Meet link of a scheduled class. Idempotent: a class
 * that already has its Google link is returned unchanged. A class with a pasted link must have
 * it removed first, so a working link is never replaced by surprise.
 */
async function requestMeeting(
  auth: AuthContext,
  scope: Scope,
  id: string,
): Promise<{ created: boolean; liveClass: LiveClassDto }> {
  assertGoogleMeetConfigured();
  await prisma.$transaction(async (tx) => {
    await requireManaged(auth, scope, id, tx);
    const current = await lockSession(tx, id);
    assertEditable(current);
    if (current.provider === GOOGLE_MEET) return;
    if (current.joinUrl) {
      throw new AppError(
        'CONFLICT',
        'This class already has a pasted meeting link. Remove it first to create a Google Meet link.',
      );
    }
    await tx.liveClassSession.update({
      where: { id },
      data: { provider: GOOGLE_MEET, meetingLastError: null, updatedById: auth.userId },
    });
  });
  const result = await provisionMeeting(id);
  const row = await reload(id);
  if (result === 'CREATED') {
    // Students already told about the class now get its joining link.
    const deliveries = await prisma.$transaction((tx) =>
      notifyAudience(tx, row, auth.userId, (audience) =>
        liveClassEvents.updated(facts(row), audience, {
          version: row.updatedAt,
          scheduleChanged: false,
        }),
      ),
    );
    dispatchAfterCommit(deliveries);
  }
  return { created: result === 'CREATED', liveClass: toDto(row, 'staff') };
}

// --- Public API ------------------------------------------------------------------------------

export const liveClassService = {
  settings(): LiveClassSettingsDto {
    return {
      googleMeet: googleMeetProvider().configured
        ? {
            available: true,
            message:
              'Google Meet links can be created automatically when you schedule a class. You can also paste a link from another tool.',
          }
        : {
            available: false,
            message:
              'Automatic Google Meet links are not set up on this server, so meetings are not created automatically. Schedule the class here and paste the meeting link from your own meeting tool.',
          },
      timeZones: [...LIVE_CLASS_TIME_ZONES],
    };
  },

  // Faculty (`live_classes.manage_assigned`, assigned courses only) ---------------------------

  async list(auth: AuthContext, query: LiveClassListQuery): Promise<Paginated<LiveClassDto>> {
    let ids = await accessPolicy.taughtCourseIds(auth, PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED);
    if (query.courseId) {
      if (!ids.includes(query.courseId)) {
        throw new AppError('FORBIDDEN', 'You are not assigned to this course');
      }
      ids = [query.courseId];
    }
    const { skip, take } = pageArgs(query);
    const page = await pageIds({ courseIds: ids, when: query.when }, skip, take);
    const rows = await loadInOrder(page.ids);
    return paginated(
      rows.map((row) => toDto(row, 'staff')),
      page.total,
      query,
    );
  },

  /** Next classes of already-authorised courses (dashboard). */
  async upcomingFor(courseIds: string[], take: number): Promise<LiveClassDto[]> {
    const page = await pageIds({ courseIds, when: 'upcoming' }, 0, take);
    return (await loadInOrder(page.ids)).map((row) => toDto(row, 'staff'));
  },

  async create(
    auth: AuthContext,
    courseId: string,
    input: LiveClassCreateInput,
  ): Promise<LiveClassCreateResult> {
    if (!(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
      notFound('Course');
    }
    await accessPolicy.assertTeachesCourse(
      auth,
      courseId,
      PERMISSIONS.LIVE_CLASSES_MANAGE_ASSIGNED,
    );
    const host = await prisma.facultyProfile.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    return createSession(auth, 'faculty', {
      courseId,
      hostFacultyProfileId: host?.id ?? null,
      input,
    });
  },

  update(auth: AuthContext, id: string, input: LiveClassUpdateInput): Promise<LiveClassDto> {
    return updateSession(auth, 'faculty', id, input);
  },

  cancel(auth: AuthContext, id: string) {
    return cancelSession(auth, 'faculty', id);
  },

  complete(auth: AuthContext, id: string) {
    return completeSession(auth, 'faculty', id);
  },

  setRecording(auth: AuthContext, id: string, input: LiveClassRecordingInput) {
    return setRecording(auth, 'faculty', id, input);
  },

  requestMeeting(auth: AuthContext, id: string) {
    return requestMeeting(auth, 'faculty', id);
  },

  // Administrators (`live_classes.manage`, any course) ----------------------------------------

  async adminList(
    auth: AuthContext,
    query: AdminLiveClassListQuery,
  ): Promise<Paginated<LiveClassDto>> {
    accessPolicy.assertPermission(auth, PERMISSIONS.LIVE_CLASSES_MANAGE);
    const { skip, take } = pageArgs(query);
    const page = await pageIds(
      {
        courseIds: query.courseId ? [query.courseId] : null,
        when: query.when,
        status: query.status,
      },
      skip,
      take,
    );
    const rows = await loadInOrder(page.ids);
    return paginated(
      rows.map((row) => toDto(row, 'staff')),
      page.total,
      query,
    );
  },

  async adminDetail(auth: AuthContext, id: string): Promise<LiveClassDto> {
    return toDto(await requireManaged(auth, 'admin', id), 'staff');
  },

  adminCreate(auth: AuthContext, input: AdminLiveClassCreateInput): Promise<LiveClassCreateResult> {
    const { courseId, hostFacultyProfileId, ...rest } = input;
    return createSession(auth, 'admin', { courseId, hostFacultyProfileId, input: rest });
  },

  adminUpdate(auth: AuthContext, id: string, input: AdminLiveClassUpdateInput) {
    return updateSession(auth, 'admin', id, input);
  },

  adminCancel(auth: AuthContext, id: string) {
    return cancelSession(auth, 'admin', id);
  },

  adminComplete(auth: AuthContext, id: string) {
    return completeSession(auth, 'admin', id);
  },

  adminSetRecording(auth: AuthContext, id: string, input: LiveClassRecordingInput) {
    return setRecording(auth, 'admin', id, input);
  },

  adminRequestMeeting(auth: AuthContext, id: string) {
    return requestMeeting(auth, 'admin', id);
  },

  /** Faculty eligible to host a course's classes (its assigned instructors). */
  async adminHostOptions(auth: AuthContext, courseId: string) {
    accessPolicy.assertPermission(auth, PERMISSIONS.LIVE_CLASSES_MANAGE);
    if (!(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
      notFound('Course');
    }
    const rows = await prisma.courseInstructor.findMany({
      where: { courseId },
      orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
      select: {
        isPrimary: true,
        facultyProfile: { select: { id: true, user: { select: { fullName: true } } } },
      },
    });
    return rows.map((row) => ({
      facultyProfileId: row.facultyProfile.id,
      fullName: row.facultyProfile.user.fullName,
      isPrimary: row.isPrimary,
    }));
  },

  // Students (ACTIVE enrolment in a PUBLISHED course) -----------------------------------------

  async forStudent(
    auth: AuthContext,
    query: StudentLiveClassQuery,
  ): Promise<Paginated<LiveClassDto>> {
    let courseIds: string[];
    if (query.courseId) {
      await accessPolicy.assertCanViewCourseContent(auth, query.courseId);
      courseIds = [query.courseId];
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: createStudentRepository(prisma).enrollments.accessibleWhere(auth.userId),
        select: { courseId: true },
      });
      courseIds = enrollments.map((row) => row.courseId);
    }
    const { skip, take } = pageArgs(query);
    const page = await pageIds({ courseIds, when: query.when }, skip, take);
    const rows = await loadInOrder(page.ids);
    return paginated(
      rows.map((row) => toDto(row, 'student')),
      page.total,
      query,
    );
  },
};
