import {
  PERMISSIONS,
  type AssignmentSettingsDto,
  type FacultyAssignmentDetail,
  type GradeHistoryEntry,
  type FacultyAssignmentItem,
  type Paginated,
  type StudentAssignmentDto,
  type StudentResultItem,
  type SubmissionDetailDto,
  type SubmissionListItem,
} from '@asra/types';
import {
  safeExternalUrlSchema,
  type AssignmentCreateInput,
  type AssignmentSettingsInput,
  type FacultyAssignmentListQuery,
  type GradeSubmissionInput,
  type PaginationQuery,
  type StudentSubmissionInput,
  type SubmissionListQuery,
} from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { pageArgs, paginated } from '../../utils/pagination.js';
import { audit } from '../assessments/audit.js';
import { coursePublicationGuard } from '../courses/courses.service.js';
import { createCurriculumRepository } from '../curriculum/curriculum.repository.js';

/**
 * Assignments, submissions and grading (PHASE 08, docs/FACULTY-PORTAL.md §5).
 *
 *   ASSIGNMENT lesson (title, instructions, attachments, DRAFT/PUBLISHED)  ← curriculum
 *     └─ Assignment (maxMarks, dueAt)                                       ← submission settings
 *          └─ AssignmentSubmission (student work → marks + feedback → result released)
 *
 * Rules:
 *   - The course is always resolved from the database (submission → assignment → lesson →
 *     chapter → module → course) and the caller must teach it (`assertTeachesCourse`).
 *   - Marks are validated against the assignment's maximum on the server; nothing computed in the
 *     browser is trusted. Grading and release lock the submission row (no lost updates).
 *   - A saved grade is invisible to the student until it is explicitly released; a released result
 *     is final (I-03/K-04 pending). Every grade save and release is audited (grade history).
 *   - One submission row per student and assignment (PHASE 09, I-02 pending): after the due date
 *     work is accepted and flagged late, or refused, per `allowLateSubmissions`; a resubmission
 *     (only with `allowResubmission`, only before grading) archives the previous version first.
 *     Lateness and acceptance are decided with SERVER time (`clock.now()`).
 */

const notFound = (entity: string): never => {
  throw new AppError('NOT_FOUND', `${entity} not found`);
};

const lessonChain = {
  chapter: {
    select: {
      id: true,
      title: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
    },
  },
} satisfies Prisma.LessonSelect;

const settingsSelect = {
  id: true,
  maxMarks: true,
  dueAt: true,
  allowLateSubmissions: true,
  allowResubmission: true,
  updatedAt: true,
} as const;

const assignmentLessonSelect = {
  id: true,
  title: true,
  description: true,
  body: true,
  status: true,
  contentType: true,
  updatedAt: true,
  ...lessonChain,
  assignment: { select: settingsSelect },
  _count: { select: { resources: true } },
} satisfies Prisma.LessonSelect;

type AssignmentLessonRow = Prisma.LessonGetPayload<{ select: typeof assignmentLessonSelect }>;

const submissionSelect = {
  id: true,
  userId: true,
  body: true,
  attachmentUrl: true,
  submittedAt: true,
  late: true,
  version: true,
  status: true,
  marksAwarded: true,
  feedback: true,
  facultyNote: true,
  gradedAt: true,
  resultReleasedAt: true,
  updatedAt: true,
  student: { select: { fullName: true } },
  gradedBy: { select: { fullName: true } },
  assignment: {
    select: {
      id: true,
      maxMarks: true,
      dueAt: true,
      lesson: { select: { id: true, title: true, ...lessonChain } },
    },
  },
} satisfies Prisma.AssignmentSubmissionSelect;

type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{ select: typeof submissionSelect }>;

// --- Mappers --------------------------------------------------------------------------------

/** Lateness is decided once, by the server, when a version is accepted. */
const isLateAt = (at: Date, dueAt: Date | null) => dueAt !== null && at > dueAt;

function toSettings(row: {
  id: string;
  maxMarks: number;
  dueAt: Date | null;
  allowLateSubmissions: boolean;
  allowResubmission: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    maxMarks: row.maxMarks,
    dueAt: row.dueAt?.toISOString() ?? null,
    allowLateSubmissions: row.allowLateSubmissions,
    allowResubmission: row.allowResubmission,
    updatedAt: row.updatedAt.toISOString(),
  } satisfies AssignmentSettingsDto;
}

/** Links are re-validated on the way out, like lesson resources (docs/STUDENT-LMS.md §6). */
function safeLink(url: string | null): string | null {
  if (url === null) return null;
  const parsed = safeExternalUrlSchema.safeParse(url);
  return parsed.success ? parsed.data : null;
}

function toSubmissionItem(row: SubmissionRow): SubmissionListItem {
  const lesson = row.assignment.lesson;
  return {
    id: row.id,
    student: { userId: row.userId, fullName: row.student.fullName },
    assignment: {
      id: row.assignment.id,
      lessonId: lesson.id,
      title: lesson.title,
      maxMarks: row.assignment.maxMarks,
      dueAt: row.assignment.dueAt?.toISOString() ?? null,
    },
    course: lesson.chapter.module.course,
    submittedAt: row.submittedAt.toISOString(),
    late: row.late,
    version: row.version,
    status: row.status,
    marksAwarded: row.marksAwarded,
    gradedAt: row.gradedAt?.toISOString() ?? null,
    resultReleasedAt: row.resultReleasedAt?.toISOString() ?? null,
  };
}

/** Detail with earlier versions and the audited grade history (two small extra queries). */
async function toSubmissionDetail(
  row: SubmissionRow,
  db: DbClient = prisma,
): Promise<SubmissionDetailDto> {
  const [revisions, events] = await Promise.all([
    db.assignmentSubmissionRevision.findMany({
      where: { submissionId: row.id },
      orderBy: { version: 'desc' },
      select: { version: true, body: true, attachmentUrl: true, submittedAt: true, late: true },
    }),
    db.assessmentAuditLog.findMany({
      where: {
        entityType: 'submission',
        entityId: row.id,
        action: { in: ['submission.graded', 'submission.released'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { action: true, createdAt: true, data: true, actor: { select: { fullName: true } } },
    }),
  ]);
  const gradeHistory: GradeHistoryEntry[] = events.map((event) => {
    const data = (event.data ?? {}) as { marksAwarded?: number; previousMarks?: number | null };
    return {
      at: event.createdAt.toISOString(),
      by: event.actor?.fullName ?? null,
      action:
        event.action === 'submission.released'
          ? 'released'
          : data.previousMarks === null || data.previousMarks === undefined
            ? 'graded'
            : 'regraded',
      marksAwarded: data.marksAwarded ?? null,
      previousMarks: data.previousMarks ?? null,
    };
  });
  return {
    ...toSubmissionItem(row),
    body: row.body,
    attachmentUrl: safeLink(row.attachmentUrl),
    feedback: row.feedback,
    facultyNote: row.facultyNote,
    gradedBy: row.gradedBy?.fullName ?? null,
    updatedAt: row.updatedAt.toISOString(),
    revisions: revisions.map((revision) => ({
      version: revision.version,
      body: revision.body,
      attachmentUrl: safeLink(revision.attachmentUrl),
      submittedAt: revision.submittedAt.toISOString(),
      late: revision.late,
    })),
    gradeHistory,
  };
}

type Counts = Map<string, { submitted: number; graded: number; released: number }>;

async function submissionCounts(assignmentIds: string[]): Promise<Counts> {
  const counts: Counts = new Map();
  if (assignmentIds.length === 0) return counts;
  const [byStatus, released] = await Promise.all([
    prisma.assignmentSubmission.groupBy({
      by: ['assignmentId', 'status'],
      where: { assignmentId: { in: assignmentIds } },
      _count: { _all: true },
    }),
    prisma.assignmentSubmission.groupBy({
      by: ['assignmentId'],
      where: { assignmentId: { in: assignmentIds }, resultReleasedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const entry = (id: string) => {
    const value = counts.get(id) ?? { submitted: 0, graded: 0, released: 0 };
    counts.set(id, value);
    return value;
  };
  for (const row of byStatus) {
    entry(row.assignmentId).submitted += row._count._all;
    if (row.status === 'GRADED') entry(row.assignmentId).graded += row._count._all;
  }
  for (const row of released) entry(row.assignmentId).released = row._count._all;
  return counts;
}

function toAssignmentItem(row: AssignmentLessonRow, counts: Counts): FacultyAssignmentItem {
  return {
    lessonId: row.id,
    title: row.title,
    status: row.status,
    course: row.chapter.module.course,
    module: { id: row.chapter.module.id, title: row.chapter.module.title },
    chapter: { id: row.chapter.id, title: row.chapter.title },
    settings: row.assignment ? toSettings(row.assignment) : null,
    counts: (row.assignment && counts.get(row.assignment.id)) || {
      submitted: 0,
      graded: 0,
      released: 0,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Helpers --------------------------------------------------------------------------------

/** A due date being set or changed must be in the future (an unchanged one may have passed). */
function assertDueDate(dueAt: string | null | undefined, previous: Date | null = null) {
  if (dueAt === undefined || dueAt === null) return;
  const next = new Date(dueAt);
  if (previous && previous.getTime() === next.getTime()) return;
  if (next.getTime() <= clock.now().getTime()) {
    throw fieldError('VALIDATION_ERROR', 'dueAt', 'Choose a due date in the future');
  }
}

async function lockCourse(tx: DbClient, courseId: string) {
  if (!(await createCurriculumRepository(tx).lockCourse(courseId))) notFound('Course');
}

/** The assignment lesson with its course, 404 for unknown ids or non-assignment lessons. */
async function requireAssignmentLesson(lessonId: string, db: DbClient = prisma) {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: assignmentLessonSelect,
  });
  if (!row || row.contentType !== 'ASSIGNMENT') notFound('Assignment');
  return row!;
}

/** Locks one submission row for the rest of the transaction and re-reads it. */
async function lockSubmission(tx: DbClient, id: string): Promise<SubmissionRow> {
  await tx.$queryRaw`SELECT "id" FROM "assignment_submissions" WHERE "id" = ${id}::uuid FOR UPDATE`;
  return tx.assignmentSubmission.findUniqueOrThrow({ where: { id }, select: submissionSelect });
}

/** Resolves a submission's course and checks the caller grades for it. */
async function requireGradableSubmission(auth: AuthContext, id: string, db: DbClient = prisma) {
  const row =
    (await db.assignmentSubmission.findUnique({ where: { id }, select: submissionSelect })) ??
    notFound('Submission');
  await accessPolicy.assertTeachesCourse(
    auth,
    row.assignment.lesson.chapter.module.course.id,
    PERMISSIONS.SUBMISSIONS_GRADE_ASSIGNED,
    db,
  );
  return row;
}

// --- Faculty: assignments -------------------------------------------------------------------

export const assignmentService = {
  async list(
    auth: AuthContext,
    query: FacultyAssignmentListQuery,
  ): Promise<Paginated<FacultyAssignmentItem>> {
    let ids = await accessPolicy.taughtCourseIds(auth, PERMISSIONS.CONTENT_MANAGE_ASSIGNED);
    if (query.courseId) {
      if (!ids.includes(query.courseId)) {
        throw new AppError('FORBIDDEN', 'You are not assigned to this course');
      }
      ids = [query.courseId];
    }
    if (ids.length === 0) return paginated([], 0, query);
    const where: Prisma.LessonWhereInput = {
      contentType: 'ASSIGNMENT',
      chapter: { module: { courseId: { in: ids } } },
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        select: assignmentLessonSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.lesson.count({ where }),
    ]);
    const counts = await submissionCounts(rows.flatMap((row) => row.assignment?.id ?? []));
    return paginated(
      rows.map((row) => toAssignmentItem(row, counts)),
      total,
      query,
    );
  },

  async detail(auth: AuthContext, lessonId: string): Promise<FacultyAssignmentDetail> {
    const row = await requireAssignmentLesson(lessonId);
    const courseId = row.chapter.module.course.id;
    await accessPolicy.assertTeachesCourse(auth, courseId, PERMISSIONS.CONTENT_MANAGE_ASSIGNED);
    const [counts, activeStudents] = await Promise.all([
      submissionCounts(row.assignment ? [row.assignment.id] : []),
      prisma.enrollment.count({ where: { courseId, status: 'ACTIVE' } }),
    ]);
    return {
      ...toAssignmentItem(row, counts),
      instructions: row.body,
      description: row.description,
      resourceCount: row._count.resources,
      activeStudents,
    };
  },

  /**
   * Creates the ASSIGNMENT lesson (appended to the chapter) and its settings in ONE transaction.
   * The lesson follows the curriculum's publication rules: saving never publishes the COURSE, and
   * the published-course guard still applies.
   */
  async create(
    auth: AuthContext,
    chapterId: string,
    input: AssignmentCreateInput,
  ): Promise<FacultyAssignmentDetail> {
    const owner =
      (await createCurriculumRepository(prisma).chapterOwner(chapterId)) ?? notFound('Chapter');
    const courseId = owner.module.courseId;
    assertDueDate(input.dueAt);
    const lessonId = await prisma.$transaction(async (tx) => {
      await accessPolicy.assertTeachesCourse(
        auth,
        courseId,
        PERMISSIONS.CONTENT_MANAGE_ASSIGNED,
        tx,
      );
      await lockCourse(tx, courseId);
      const lesson = await createCurriculumRepository(tx).lessons.create(chapterId, {
        title: input.title,
        description: input.description ?? null,
        contentType: 'ASSIGNMENT',
        body: input.instructions,
        status: input.status,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      });
      await tx.assignment.create({
        data: {
          lessonId: lesson.id,
          maxMarks: input.maxMarks,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          allowLateSubmissions: input.allowLateSubmissions ?? true,
          allowResubmission: input.allowResubmission ?? false,
          createdById: auth.userId,
        },
      });
      await coursePublicationGuard.assertStillPublishable(tx, courseId);
      return lesson.id;
    });
    return assignmentService.detail(auth, lessonId);
  },

  /**
   * Sets up or changes online submission for an ASSIGNMENT lesson. The maximum cannot change once
   * any submission has been graded (marks already given would no longer mean the same thing).
   * Submitted work is never touched by a settings change.
   */
  async saveSettings(
    auth: AuthContext,
    lessonId: string,
    input: AssignmentSettingsInput,
  ): Promise<FacultyAssignmentDetail> {
    const row = await requireAssignmentLesson(lessonId);
    const courseId = row.chapter.module.course.id;
    await prisma.$transaction(async (tx) => {
      await accessPolicy.assertTeachesCourse(
        auth,
        courseId,
        PERMISSIONS.CONTENT_MANAGE_ASSIGNED,
        tx,
      );
      await lockCourse(tx, courseId);
      const current = await tx.assignment.findUnique({
        where: { lessonId },
        select: { id: true, maxMarks: true, dueAt: true },
      });
      assertDueDate(input.dueAt, current?.dueAt ?? null);
      const dueAt =
        input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null;
      if (!current) {
        await tx.assignment.create({
          data: {
            lessonId,
            maxMarks: input.maxMarks,
            dueAt: dueAt ?? null,
            allowLateSubmissions: input.allowLateSubmissions ?? true,
            allowResubmission: input.allowResubmission ?? false,
            createdById: auth.userId,
          },
        });
        return;
      }
      if (current.maxMarks !== input.maxMarks) {
        const graded = await tx.assignmentSubmission.count({
          where: { assignmentId: current.id, status: 'GRADED' },
        });
        if (graded > 0) {
          throw fieldError(
            'CONFLICT',
            'maxMarks',
            'Submissions have already been graded out of the current maximum, so it cannot change.',
          );
        }
      }
      await tx.assignment.update({
        where: { id: current.id },
        data: {
          maxMarks: input.maxMarks,
          ...(dueAt === undefined ? {} : { dueAt }),
          ...(input.allowLateSubmissions === undefined
            ? {}
            : { allowLateSubmissions: input.allowLateSubmissions }),
          ...(input.allowResubmission === undefined
            ? {}
            : { allowResubmission: input.allowResubmission }),
        },
      });
    });
    return assignmentService.detail(auth, lessonId);
  },
};

// --- Faculty: submissions & grading ---------------------------------------------------------

export const submissionService = {
  async list(
    auth: AuthContext,
    query: SubmissionListQuery,
  ): Promise<Paginated<SubmissionListItem>> {
    let ids = await accessPolicy.taughtCourseIds(auth, PERMISSIONS.SUBMISSIONS_GRADE_ASSIGNED);
    if (query.lessonId) {
      const lesson = await requireAssignmentLesson(query.lessonId);
      ids = ids.filter((id) => id === lesson.chapter.module.course.id);
      if (ids.length === 0) throw new AppError('FORBIDDEN', 'You are not assigned to this course');
    }
    if (query.courseId) {
      if (!ids.includes(query.courseId)) {
        throw new AppError('FORBIDDEN', 'You are not assigned to this course');
      }
      ids = [query.courseId];
    }
    if (ids.length === 0) return paginated([], 0, query);

    const where: Prisma.AssignmentSubmissionWhereInput = {
      assignment: {
        lesson: {
          ...(query.lessonId ? { id: query.lessonId } : {}),
          chapter: { module: { courseId: { in: ids } } },
        },
      },
      ...(query.status === 'SUBMITTED' ? { status: 'SUBMITTED' } : {}),
      ...(query.status === 'GRADED' ? { status: 'GRADED', resultReleasedAt: null } : {}),
      ...(query.status === 'RELEASED' ? { resultReleasedAt: { not: null } } : {}),
    };
    const direction = query.sort === 'newest' ? 'desc' : 'asc';
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        select: submissionSelect,
        orderBy: [{ submittedAt: direction }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.assignmentSubmission.count({ where }),
    ]);
    return paginated(rows.map(toSubmissionItem), total, query);
  },

  /** Oldest submissions waiting for review in the given (already authorised) courses. */
  async pendingFor(courseIds: string[], take: number): Promise<SubmissionListItem[]> {
    if (courseIds.length === 0) return [];
    const rows = await prisma.assignmentSubmission.findMany({
      where: {
        status: 'SUBMITTED',
        assignment: { lesson: { chapter: { module: { courseId: { in: courseIds } } } } },
      },
      select: submissionSelect,
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take,
    });
    return rows.map(toSubmissionItem);
  },

  async detail(auth: AuthContext, id: string): Promise<SubmissionDetailDto> {
    return toSubmissionDetail(await requireGradableSubmission(auth, id));
  },

  /**
   * Records marks + feedback. Allowed while the result is unreleased (re-grading included);
   * `expectedUpdatedAt` turns a concurrent review into 409 instead of a silent overwrite.
   */
  async grade(
    auth: AuthContext,
    id: string,
    input: GradeSubmissionInput,
  ): Promise<SubmissionDetailDto> {
    return prisma.$transaction(async (tx) => {
      await requireGradableSubmission(auth, id, tx);
      const current = await lockSubmission(tx, id);
      if (current.resultReleasedAt !== null) {
        throw new AppError(
          'CONFLICT',
          'This result has already been released and cannot be changed.',
        );
      }
      if (
        input.expectedUpdatedAt &&
        current.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()
      ) {
        throw new AppError(
          'CONFLICT',
          'This submission was reviewed by someone else since you opened it. Reload it and try again.',
        );
      }
      if (input.marksAwarded > current.assignment.maxMarks) {
        throw fieldError(
          'VALIDATION_ERROR',
          'marksAwarded',
          `Marks cannot exceed the maximum of ${current.assignment.maxMarks}`,
        );
      }
      const feedback = input.feedback ?? null;
      const facultyNote = input.facultyNote === undefined ? current.facultyNote : input.facultyNote;
      // A retried request with identical content changes nothing and adds no history entry.
      if (
        current.status === 'GRADED' &&
        current.marksAwarded === input.marksAwarded &&
        current.feedback === feedback &&
        current.facultyNote === facultyNote
      ) {
        return toSubmissionDetail(current, tx);
      }
      const updated = await tx.assignmentSubmission.update({
        where: { id },
        data: {
          status: 'GRADED',
          marksAwarded: input.marksAwarded,
          feedback,
          facultyNote,
          gradedById: auth.userId,
          gradedAt: clock.now(),
        },
        select: submissionSelect,
      });
      await audit(tx, {
        action: 'submission.graded',
        actorId: auth.userId,
        entityType: 'submission',
        entityId: id,
        data: {
          marksAwarded: input.marksAwarded,
          previousMarks: current.status === 'GRADED' ? current.marksAwarded : null,
          version: current.version,
        },
      });
      return toSubmissionDetail(updated, tx);
    });
  },

  /** Makes a graded result visible to its student. Idempotent; a released result is final. */
  async release(
    auth: AuthContext,
    id: string,
  ): Promise<{ released: boolean; submission: SubmissionDetailDto }> {
    return prisma.$transaction(async (tx) => {
      await requireGradableSubmission(auth, id, tx);
      const current = await lockSubmission(tx, id);
      if (current.resultReleasedAt !== null) {
        return { released: false, submission: await toSubmissionDetail(current, tx) };
      }
      if (current.status !== 'GRADED') {
        throw new AppError('CONFLICT', 'Grade this submission before releasing the result.');
      }
      const updated = await tx.assignmentSubmission.update({
        where: { id },
        data: { resultReleasedAt: clock.now() },
        select: submissionSelect,
      });
      await audit(tx, {
        action: 'submission.released',
        actorId: auth.userId,
        entityType: 'submission',
        entityId: id,
        data: { marksAwarded: updated.marksAwarded },
      });
      return { released: true, submission: await toSubmissionDetail(updated, tx) };
    });
  },
};

// --- Student --------------------------------------------------------------------------------

/** The published assignment lesson + the student's access to its course (drafts are 404). */
async function requireStudentAssignment(
  auth: AuthContext,
  lessonId: string,
  db: DbClient = prisma,
) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      status: true,
      contentType: true,
      chapter: { select: { module: { select: { courseId: true } } } },
      assignment: {
        select: {
          id: true,
          maxMarks: true,
          dueAt: true,
          allowLateSubmissions: true,
          allowResubmission: true,
        },
      },
    },
  });
  if (!lesson || lesson.status !== 'PUBLISHED') notFound('Lesson');
  await accessPolicy.assertCanViewCourseContent(auth, lesson!.chapter.module.courseId, db);
  if (lesson!.contentType !== 'ASSIGNMENT') notFound('Assignment');
  return lesson!;
}

type StudentAssignmentSettings = NonNullable<
  Awaited<ReturnType<typeof requireStudentAssignment>>['assignment']
>;

const studentSubmissionSelect = {
  id: true,
  body: true,
  attachmentUrl: true,
  submittedAt: true,
  late: true,
  version: true,
  status: true,
  marksAwarded: true,
  feedback: true,
  resultReleasedAt: true,
} as const;

type StudentSubmissionRow = Prisma.AssignmentSubmissionGetPayload<{
  select: typeof studentSubmissionSelect;
}>;

function toStudentSubmission(row: StudentSubmissionRow, assignment: { maxMarks: number }) {
  const released = row.resultReleasedAt !== null && row.marksAwarded !== null;
  return {
    id: row.id,
    body: row.body,
    attachmentUrl: safeLink(row.attachmentUrl),
    submittedAt: row.submittedAt.toISOString(),
    late: row.late,
    version: row.version,
    // An unreleased grade is not disclosed, not even as a status. The private faculty note is
    // never selected for students.
    state: released ? ('RESULT_RELEASED' as const) : ('SUBMITTED' as const),
    result: released
      ? {
          marksAwarded: row.marksAwarded!,
          maxMarks: assignment.maxMarks,
          feedback: row.feedback,
          releasedAt: row.resultReleasedAt!.toISOString(),
        }
      : null,
  };
}

/**
 * The single submission policy (docs/ASSESSMENTS.md §6), evaluated at SERVER time `now`:
 *   - no settings                → online submission not open
 *   - nothing submitted yet      → allowed; after the due date only with allowLateSubmissions
 *   - already submitted          → only with allowResubmission, while not yet graded, and under
 *                                   the same due-date rule
 */
export function submissionPolicy(
  assignment: StudentAssignmentSettings | null,
  existing: { status: 'SUBMITTED' | 'GRADED' } | null,
  now: Date,
): { allowed: boolean; reason: string | null; late: boolean } {
  if (!assignment) {
    return {
      allowed: false,
      reason:
        'Online submission is not open for this assignment. Follow your faculty’s instructions.',
      late: false,
    };
  }
  const late = isLateAt(now, assignment.dueAt);
  if (existing) {
    if (!assignment.allowResubmission) {
      return { allowed: false, reason: 'You have already submitted this assignment.', late };
    }
    if (existing.status !== 'SUBMITTED') {
      return {
        allowed: false,
        reason: 'Your work has already been graded, so it can no longer be replaced.',
        late,
      };
    }
  }
  if (late && !assignment.allowLateSubmissions) {
    return {
      allowed: false,
      reason: 'The due date has passed and this assignment does not accept late submissions.',
      late,
    };
  }
  return { allowed: true, reason: null, late };
}

/** File uploads need a storage provider (R-01); none is configured, so links are offered instead. */
const FILE_UPLOADS_UNAVAILABLE = {
  available: false,
  message:
    'File uploads are not available yet (no storage provider is configured). Share a link to your work instead.',
};

export const studentAssignmentService = {
  async get(auth: AuthContext, lessonId: string): Promise<StudentAssignmentDto> {
    const lesson = await requireStudentAssignment(auth, lessonId);
    const submission = lesson.assignment
      ? await prisma.assignmentSubmission.findUnique({
          where: {
            assignmentId_userId: { assignmentId: lesson.assignment.id, userId: auth.userId },
          },
          select: studentSubmissionSelect,
        })
      : null;
    const policy = submissionPolicy(lesson.assignment, submission, clock.now());
    return {
      lessonId,
      acceptingSubmissions: lesson.assignment !== null,
      maxMarks: lesson.assignment?.maxMarks ?? null,
      dueAt: lesson.assignment?.dueAt?.toISOString() ?? null,
      allowLateSubmissions: lesson.assignment?.allowLateSubmissions ?? false,
      allowResubmission: lesson.assignment?.allowResubmission ?? false,
      canSubmit: policy.allowed,
      cannotSubmitReason: policy.reason,
      fileUploads: FILE_UPLOADS_UNAVAILABLE,
      submission: submission ? toStudentSubmission(submission, lesson.assignment!) : null,
    };
  },

  /**
   * Accepts a submission or a permitted resubmission. The acceptance time and lateness are
   * computed here from server time; nothing time-related is read from the request. A resubmission
   * locks the row and archives the previous version before replacing it.
   */
  async submit(
    auth: AuthContext,
    lessonId: string,
    input: StudentSubmissionInput,
  ): Promise<StudentAssignmentDto> {
    await prisma.$transaction(async (tx) => {
      const lesson = await requireStudentAssignment(auth, lessonId, tx);
      const assignment = lesson.assignment;
      const existingRef = assignment
        ? await tx.assignmentSubmission.findUnique({
            where: { assignmentId_userId: { assignmentId: assignment.id, userId: auth.userId } },
            select: { id: true },
          })
        : null;
      if (existingRef) {
        await tx.$queryRaw`SELECT "id" FROM "assignment_submissions" WHERE "id" = ${existingRef.id}::uuid FOR UPDATE`;
      }
      const existing = existingRef
        ? await tx.assignmentSubmission.findUniqueOrThrow({
            where: { id: existingRef.id },
            select: studentSubmissionSelect,
          })
        : null;
      const now = clock.now();
      const policy = submissionPolicy(assignment, existing, now);
      if (!policy.allowed) throw new AppError('CONFLICT', policy.reason!);

      if (existing) {
        await tx.assignmentSubmissionRevision.create({
          data: {
            submissionId: existing.id,
            version: existing.version,
            body: existing.body,
            attachmentUrl: existing.attachmentUrl,
            submittedAt: existing.submittedAt,
            late: existing.late,
            archivedAt: now,
          },
        });
        await tx.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            body: input.body,
            attachmentUrl: input.attachmentUrl ?? null,
            submittedAt: now,
            late: policy.late,
            version: existing.version + 1,
          },
        });
        await audit(tx, {
          action: 'submission.resubmitted',
          actorId: auth.userId,
          entityType: 'submission',
          entityId: existing.id,
          data: { version: existing.version + 1, late: policy.late },
        });
        return;
      }
      try {
        await tx.assignmentSubmission.create({
          data: {
            assignmentId: assignment!.id,
            userId: auth.userId,
            body: input.body,
            attachmentUrl: input.attachmentUrl ?? null,
            submittedAt: now,
            late: policy.late,
          },
          select: { id: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError('CONFLICT', 'You have already submitted this assignment.');
        }
        throw error;
      }
    });
    return studentAssignmentService.get(auth, lessonId);
  },

  /** The student's own released results, newest first. */
  async results(auth: AuthContext, query: PaginationQuery): Promise<Paginated<StudentResultItem>> {
    const where: Prisma.AssignmentSubmissionWhereInput = {
      userId: auth.userId,
      resultReleasedAt: { not: null },
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        orderBy: [{ resultReleasedAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          submittedAt: true,
          marksAwarded: true,
          feedback: true,
          resultReleasedAt: true,
          assignment: {
            select: {
              maxMarks: true,
              lesson: { select: { id: true, title: true, contentType: true, ...lessonChain } },
            },
          },
        },
        skip,
        take,
      }),
      prisma.assignmentSubmission.count({ where }),
    ]);
    return paginated(
      rows.map((row) => {
        const lesson = row.assignment.lesson;
        return {
          submissionId: row.id,
          course: lesson.chapter.module.course,
          lesson: {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            contentType: lesson.contentType,
            chapterTitle: lesson.chapter.title,
            moduleTitle: lesson.chapter.module.title,
          },
          marksAwarded: row.marksAwarded!,
          maxMarks: row.assignment.maxMarks,
          feedback: row.feedback,
          submittedAt: row.submittedAt.toISOString(),
          releasedAt: row.resultReleasedAt!.toISOString(),
        };
      }),
      total,
      query,
    );
  },
};
