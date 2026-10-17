import { randomInt } from 'node:crypto';
import type {
  AnswerReveal,
  AttemptQuestionDto,
  AttemptResultState,
  AttemptScoreDto,
  FacultyAttemptDetail,
  FacultyAttemptItem,
  ReviewQuestionDto,
  StudentAttemptDto,
  StudentAttemptSummary,
} from '@asra/types';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { clock } from '../../lib/clock.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../utils/app-error.js';
import { audit } from './audit.js';
import { fromCents, isAnswered, scoreAttempt, toCents, type ScoringQuestion } from './scoring.js';

/**
 * Shared attempt machinery for quizzes and examinations (docs/ASSESSMENTS.md §4–§8).
 *
 *   start  → snapshot of the assigned questions (order, options, keys, marks) is persisted
 *   answer → stored against the attempt's own snapshot, only while IN_PROGRESS and before the
 *            server deadline (row lock serialises answers with finalization)
 *   final  → ONE code path (`finalizeLocked`) for submit, deadline expiry and quiz closure: it runs
 *            on a row locked FOR UPDATE and only from IN_PROGRESS, so retries, concurrent submits
 *            and the sweeper can never finalize or score an attempt twice
 *
 * Every read/save/submit re-checks the deadline itself (`expireIfDue`), so correctness never
 * depends on the background sweeper having run.
 */

// --- Snapshot -------------------------------------------------------------------------------

export interface SnapshotOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionSnapshot {
  prompt: string;
  explanation: string | null;
  options: SnapshotOption[];
}

export function readSnapshot(value: Prisma.JsonValue): QuestionSnapshot {
  const raw = (value ?? {}) as Partial<QuestionSnapshot>;
  return {
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    explanation: typeof raw.explanation === 'string' ? raw.explanation : null,
    options: Array.isArray(raw.options) ? raw.options : [],
  };
}

/** Fisher–Yates with a CSPRNG (students cannot predict the order from earlier attempts). */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export const sourceQuestionSelect = {
  id: true,
  type: true,
  prompt: true,
  explanation: true,
  marks: true,
  negativeMarks: true,
  position: true,
  options: {
    orderBy: { position: 'asc' },
    select: { id: true, text: true, isCorrect: true, position: true },
  },
} satisfies Prisma.AssessmentQuestionSelect;

export type SourceQuestion = Prisma.AssessmentQuestionGetPayload<{
  select: typeof sourceQuestionSelect;
}>;

/**
 * Picks and orders the questions of a new attempt. With `take`, a uniformly random subset is drawn
 * (kept in authoring order unless questions are shuffled). True/False options are never shuffled.
 */
export function selectQuestions(
  questions: readonly SourceQuestion[],
  rules: { shuffleQuestions: boolean; shuffleOptions: boolean; take: number | null },
) {
  let chosen = [...questions].sort((a, b) => a.position - b.position);
  if (rules.take !== null && rules.take < chosen.length) {
    const picked = new Set(
      shuffled(chosen)
        .slice(0, rules.take)
        .map((q) => q.id),
    );
    chosen = chosen.filter((q) => picked.has(q.id));
  }
  if (rules.shuffleQuestions) chosen = shuffled(chosen);
  return chosen.map((question, position) => {
    const options = question.options.map(({ id, text, isCorrect }) => ({ id, text, isCorrect }));
    const snapshot: QuestionSnapshot = {
      prompt: question.prompt,
      explanation: question.explanation,
      options: rules.shuffleOptions && question.type !== 'TRUE_FALSE' ? shuffled(options) : options,
    };
    return {
      questionId: question.id,
      position,
      type: question.type,
      snapshot: snapshot as unknown as Prisma.InputJsonObject,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
    };
  });
}

/**
 * Serialises attempt creation for ONE student and ONE assessment (transaction-scoped advisory
 * lock), so concurrent "start" requests see each other's attempt instead of both passing the
 * attempt-limit check. The unique (assessment, user, attemptNumber) index is the backstop.
 */
export async function lockStudentAssessment(tx: DbClient, assessmentId: string, userId: string) {
  const key = `assessment:${assessmentId}:${userId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS l`;
}

// --- Attempt rows ---------------------------------------------------------------------------

const lessonCourse = {
  select: {
    id: true,
    title: true,
    chapter: { select: { module: { select: { course: { select: { id: true, title: true } } } } } },
  },
} as const;

export const attemptSelect = {
  id: true,
  quizId: true,
  examinationId: true,
  userId: true,
  attemptNumber: true,
  status: true,
  startedAt: true,
  deadlineAt: true,
  submittedAt: true,
  finalizedAt: true,
  evaluationStatus: true,
  maxScore: true,
  rawScore: true,
  penalty: true,
  score: true,
  percent: true,
  passed: true,
  evaluatedAt: true,
  updatedAt: true,
  student: { select: { fullName: true } },
  questions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      questionId: true,
      position: true,
      type: true,
      snapshot: true,
      marks: true,
      negativeMarks: true,
      selectedOptionIds: true,
      textAnswer: true,
      answerSequence: true,
      answeredAt: true,
      awardedMarks: true,
      penalty: true,
      isCorrect: true,
      feedback: true,
      gradedAt: true,
      gradedBy: { select: { fullName: true } },
    },
  },
  quiz: {
    select: {
      id: true,
      status: true,
      negativeMarking: true,
      passPercent: true,
      showResultImmediately: true,
      answerReveal: true,
      resultsPublishedAt: true,
      lesson: lessonCourse,
    },
  },
  examination: {
    select: {
      id: true,
      title: true,
      status: true,
      negativeMarking: true,
      passPercent: true,
      answerReveal: true,
      resultsPublishedAt: true,
      closesAt: true,
      course: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.AssessmentAttemptSelect;

export type AttemptRow = Prisma.AssessmentAttemptGetPayload<{ select: typeof attemptSelect }>;

/** The same attempt fields without its questions, for lists and summaries. */
const { questions: _questions, ...summaryFields } = attemptSelect;
export const attemptSummarySelect = summaryFields satisfies Prisma.AssessmentAttemptSelect;
export type AttemptSummaryRow = Prisma.AssessmentAttemptGetPayload<{
  select: typeof attemptSummarySelect;
}>;

/** The assessment an attempt belongs to, flattened for both kinds. */
export function assessmentOf(row: AttemptSummaryRow) {
  if (row.quiz) {
    const lesson = row.quiz.lesson;
    return {
      kind: 'QUIZ' as const,
      id: row.quiz.id,
      title: lesson.title,
      lessonId: lesson.id,
      course: lesson.chapter.module.course,
      negativeMarking: row.quiz.negativeMarking,
      passPercent: row.quiz.passPercent,
      answerReveal: row.quiz.answerReveal as AnswerReveal,
      resultsReleased: row.quiz.showResultImmediately || row.quiz.resultsPublishedAt !== null,
      resultsPublishedAt: row.quiz.resultsPublishedAt,
      closed: (_now: Date) => row.quiz!.status === 'CLOSED',
    };
  }
  const exam = row.examination!;
  return {
    kind: 'EXAM' as const,
    id: exam.id,
    title: exam.title,
    lessonId: null,
    course: exam.course,
    negativeMarking: exam.negativeMarking,
    passPercent: exam.passPercent,
    answerReveal: exam.answerReveal as AnswerReveal,
    resultsReleased: exam.resultsPublishedAt !== null,
    resultsPublishedAt: exam.resultsPublishedAt,
    closed: (now: Date) => exam.status === 'CLOSED' || now >= exam.closesAt,
  };
}

export async function findAttempt(db: DbClient, id: string): Promise<AttemptRow | null> {
  return db.assessmentAttempt.findUnique({ where: { id }, select: attemptSelect });
}

/** Locks the attempt row for the rest of the transaction and re-reads it. */
export async function lockAttempt(tx: DbClient, id: string): Promise<AttemptRow | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "assessment_attempts" WHERE "id" = ${id}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  return findAttempt(tx, id);
}

export const isExpired = (row: Pick<AttemptRow, 'status' | 'deadlineAt'>, now: Date) =>
  row.status === 'IN_PROGRESS' && row.deadlineAt !== null && now >= row.deadlineAt;

function scoringInput(row: AttemptRow): ScoringQuestion[] {
  return row.questions.map((question) => {
    const snapshot = readSnapshot(question.snapshot);
    return {
      type: question.type,
      marks: toCents(question.marks),
      negativeMarks: toCents(question.negativeMarks),
      correctOptionIds: snapshot.options.filter((o) => o.isCorrect).map((o) => o.id),
      selectedOptionIds: question.selectedOptionIds,
      textAnswer: question.textAnswer,
      manualMarks:
        question.type === 'SHORT_ANSWER' &&
        question.gradedAt !== null &&
        question.awardedMarks !== null
          ? toCents(question.awardedMarks)
          : null,
    };
  });
}

const decimal = (cents: number) => new Prisma.Decimal(fromCents(cents).toFixed(2));

/**
 * Writes the evaluation of an attempt from its persisted answers: per-question outcomes and,
 * when nothing awaits manual grading, the attempt score. Idempotent: running it twice on the same
 * answers writes the same values.
 */
async function writeEvaluation(tx: DbClient, row: AttemptRow, now: Date) {
  const assessment = assessmentOf(row);
  const evaluation = scoreAttempt(scoringInput(row), {
    negativeMarking: assessment.negativeMarking,
    passPercent: assessment.passPercent,
  });
  await Promise.all(
    row.questions.map((question, index) => {
      const outcome = evaluation.outcomes[index]!;
      if (question.type === 'SHORT_ANSWER' && outcome.pendingManual) return null;
      if (question.type === 'SHORT_ANSWER' && question.gradedAt !== null) return null;
      return tx.attemptQuestion.update({
        where: { id: question.id },
        data: {
          awardedMarks: outcome.awarded === null ? null : decimal(outcome.awarded),
          penalty: decimal(outcome.penalty),
          isCorrect: outcome.isCorrect,
        },
      });
    }),
  );
  const score = evaluation.score;
  return {
    evaluationStatus: score ? ('EVALUATED' as const) : ('PENDING' as const),
    rawScore: score ? decimal(score.rawScore) : null,
    penalty: score ? decimal(score.penalty) : null,
    score: score ? decimal(score.score) : null,
    percent: score ? decimal(score.percent) : null,
    passed: score ? score.passed : null,
    evaluatedAt: score ? now : null,
  };
}

export type FinalizationMode = 'SUBMITTED' | 'EXPIRED';

/**
 * THE finalization path. Must be called on a row locked with `lockAttempt` that is IN_PROGRESS.
 * EXPIRED attempts are recorded as submitted at their deadline (the answers saved before it).
 */
export async function finalizeLocked(
  tx: DbClient,
  row: AttemptRow,
  mode: FinalizationMode,
  now: Date,
  actorId: string | null,
): Promise<AttemptRow> {
  if (row.status !== 'IN_PROGRESS') {
    throw new Error(`finalizeLocked called on a ${row.status} attempt`);
  }
  if (mode === 'EXPIRED' && row.deadlineAt === null) {
    throw new Error('An attempt without a deadline cannot expire');
  }
  const scored = await writeEvaluation(tx, row, now);
  await tx.assessmentAttempt.update({
    where: { id: row.id },
    data: {
      status: mode,
      submittedAt: mode === 'EXPIRED' ? row.deadlineAt! : now,
      finalizedAt: now,
      ...scored,
    },
  });
  await audit(tx, {
    action: 'attempt.finalized',
    actorId,
    entityType: 'attempt',
    entityId: row.id,
    data: {
      mode,
      evaluationStatus: scored.evaluationStatus,
      score: scored.score?.toString() ?? null,
    },
  });
  return (await findAttempt(tx, row.id))!;
}

/** Finalizes a locked attempt whose deadline has passed; returns the (possibly new) row. */
export async function expireIfDue(tx: DbClient, row: AttemptRow, now: Date): Promise<AttemptRow> {
  return isExpired(row, now) ? finalizeLocked(tx, row, 'EXPIRED', now, null) : row;
}

/**
 * Lazily applies expiry before an attempt is shown: a cheap unlocked read first, and a locked
 * finalization only when the deadline has passed.
 */
export async function loadWithExpiry(id: string, now = clock.now()): Promise<AttemptRow | null> {
  const row = await findAttempt(prisma, id);
  if (!row || !isExpired(row, now)) return row;
  return prisma.$transaction(async (tx) => {
    const locked = await lockAttempt(tx, id);
    return locked ? expireIfDue(tx, locked, now) : null;
  });
}

/**
 * Ends every running attempt of an assessment that is being closed (quiz closure). Each attempt's
 * deadline is moved to now (never before its start) and it is finalized as EXPIRED with the
 * answers saved so far.
 */
export async function finalizeAllInProgress(
  tx: DbClient,
  where: { quizId: string } | { examinationId: string },
  now: Date,
  actorId: string,
): Promise<number> {
  const running = await tx.assessmentAttempt.findMany({
    where: { ...where, status: 'IN_PROGRESS' },
    select: { id: true },
  });
  for (const { id } of running) {
    const row = await lockAttempt(tx, id);
    if (!row || row.status !== 'IN_PROGRESS') continue;
    const cutoff = new Date(Math.max(now.getTime(), row.startedAt.getTime() + 1));
    if (row.deadlineAt === null || row.deadlineAt > cutoff) {
      await tx.assessmentAttempt.update({ where: { id }, data: { deadlineAt: cutoff } });
    }
    const updated = (await findAttempt(tx, id))!;
    await finalizeLocked(tx, updated, 'EXPIRED', now, actorId);
  }
  return running.length;
}

/**
 * Background/maintenance sweep: finalizes attempts whose deadline has passed and nobody touched
 * them since. `SKIP LOCKED` lets several API instances (or a request) work in parallel without
 * waiting on each other; finalization itself is idempotent. Restart-safe: deadlines live in the
 * database, nothing is kept in memory.
 */
export async function sweepExpiredAttempts(
  options: { now?: Date; batchSize?: number; where?: Prisma.Sql } = {},
): Promise<number> {
  const now = options.now ?? clock.now();
  const batchSize = options.batchSize ?? 25;
  const extra = options.where ?? Prisma.empty;
  let total = 0;
  for (;;) {
    const processed = await prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "assessment_attempts"
         WHERE "status" = 'IN_PROGRESS' AND "deadline_at" IS NOT NULL AND "deadline_at" <= ${now}
         ${extra}
         ORDER BY "deadline_at"
         LIMIT ${batchSize}
         FOR UPDATE SKIP LOCKED`;
      for (const { id } of ids) {
        const row = await findAttempt(tx, id);
        if (row) await expireIfDue(tx, row, now);
      }
      return ids.length;
    });
    total += processed;
    if (processed < batchSize) break;
  }
  if (total > 0) logger.info({ finalized: total }, 'Expired assessment attempts finalized');
  return total;
}

/** Re-scores a finalized attempt after manual grading (still idempotent). */
export async function reevaluateLocked(tx: DbClient, row: AttemptRow, now: Date) {
  const scored = await writeEvaluation(tx, row, now);
  await tx.assessmentAttempt.update({ where: { id: row.id }, data: scored });
  return (await findAttempt(tx, row.id))!;
}

// --- Visibility -----------------------------------------------------------------------------

export function resultStateOf(row: AttemptSummaryRow): AttemptResultState {
  if (row.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (row.evaluationStatus !== 'EVALUATED') return 'PENDING_EVALUATION';
  return assessmentOf(row).resultsReleased ? 'RELEASED' : 'AWAITING_RELEASE';
}

/** Correct answers/explanations: only after the result itself is visible, per `answerReveal`. */
export function answersRevealed(row: AttemptSummaryRow, now: Date): boolean {
  if (resultStateOf(row) !== 'RELEASED') return false;
  const assessment = assessmentOf(row);
  if (assessment.answerReveal === 'AFTER_SUBMISSION') return true;
  if (assessment.answerReveal === 'AFTER_CLOSE') return assessment.closed(now);
  return false;
}

// --- Serialisers ----------------------------------------------------------------------------

const num = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : fromCents(toCents(value));

export function scoreOf(row: AttemptSummaryRow): AttemptScoreDto | null {
  if (row.evaluationStatus !== 'EVALUATED' || row.score === null) return null;
  return {
    rawScore: num(row.rawScore) ?? 0,
    penalty: num(row.penalty) ?? 0,
    score: num(row.score) ?? 0,
    maxScore: num(row.maxScore) ?? 0,
    percent: num(row.percent) ?? 0,
    passed: row.passed ?? false,
  };
}

function toAttemptQuestion(question: AttemptRow['questions'][number]): AttemptQuestionDto {
  const snapshot = readSnapshot(question.snapshot);
  return {
    id: question.id,
    position: question.position,
    type: question.type,
    prompt: snapshot.prompt,
    marks: num(question.marks) ?? 0,
    negativeMarks: num(question.negativeMarks) ?? 0,
    // The answer key never leaves the server here.
    options: snapshot.options.map(({ id, text }) => ({ id, text })),
    selectedOptionIds: question.selectedOptionIds,
    textAnswer: question.textAnswer,
    answerSequence: question.answerSequence,
  };
}

export function toReviewQuestions(row: AttemptRow): ReviewQuestionDto[] {
  return row.questions.map((question) => {
    const snapshot = readSnapshot(question.snapshot);
    const selected = new Set(question.selectedOptionIds);
    return {
      id: question.id,
      position: question.position,
      type: question.type,
      prompt: snapshot.prompt,
      explanation: snapshot.explanation,
      marks: num(question.marks) ?? 0,
      negativeMarks: num(question.negativeMarks) ?? 0,
      options: snapshot.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        selected: selected.has(option.id),
      })),
      textAnswer: question.textAnswer,
      answered: isAnswered(question),
      awardedMarks: num(question.awardedMarks),
      penalty: num(question.penalty),
      isCorrect: question.isCorrect,
      feedback: question.feedback,
      gradedAt: question.gradedAt?.toISOString() ?? null,
    };
  });
}

export function toStudentSummary(row: AttemptSummaryRow): StudentAttemptSummary {
  const resultState = resultStateOf(row);
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    resultState,
    result: resultState === 'RELEASED' ? scoreOf(row) : null,
  };
}

export function toStudentAttempt(row: AttemptRow, now: Date): StudentAttemptDto {
  const assessment = assessmentOf(row);
  const summary = toStudentSummary(row);
  const revealed = answersRevealed(row, now);
  return {
    id: row.id,
    kind: assessment.kind,
    assessment: {
      id: assessment.id,
      title: assessment.title,
      lessonId: assessment.lessonId,
      course: assessment.course,
    },
    attemptNumber: row.attemptNumber,
    status: row.status,
    startedAt: summary.startedAt,
    deadlineAt: summary.deadlineAt,
    submittedAt: summary.submittedAt,
    serverNow: now.toISOString(),
    negativeMarking: assessment.negativeMarking,
    maxScore: num(row.maxScore) ?? 0,
    questions: row.questions.map(toAttemptQuestion),
    resultState: summary.resultState,
    result: summary.result,
    review: revealed ? toReviewQuestions(row) : null,
  };
}

export function toFacultyItem(row: AttemptSummaryRow): FacultyAttemptItem {
  const assessment = assessmentOf(row);
  return {
    id: row.id,
    kind: assessment.kind,
    assessment: { id: assessment.id, title: assessment.title, lessonId: assessment.lessonId },
    course: assessment.course,
    student: { userId: row.userId, fullName: row.student.fullName },
    attemptNumber: row.attemptNumber,
    status: row.status,
    evaluationStatus: row.evaluationStatus,
    startedAt: row.startedAt.toISOString(),
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    maxScore: num(row.maxScore) ?? 0,
    result: scoreOf(row),
  };
}

export function toFacultyDetail(row: AttemptRow): FacultyAttemptDetail {
  const graders = new Set(
    row.questions.flatMap((question) => (question.gradedBy ? [question.gradedBy.fullName] : [])),
  );
  return {
    ...toFacultyItem(row),
    // Running attempts show what was saved so far, but never a key-annotated live view.
    questions: row.status === 'IN_PROGRESS' ? [] : toReviewQuestions(row),
    gradedBy: [...graders],
  };
}

// --- Counting -------------------------------------------------------------------------------

export async function attemptCounts(
  where: { quizId: { in: string[] } } | { examinationId: { in: string[] } },
) {
  const key = 'quizId' in where ? 'quizId' : 'examinationId';
  const ids = 'quizId' in where ? where.quizId.in : where.examinationId.in;
  const counts = new Map<
    string,
    { total: number; inProgress: number; pendingEvaluation: number; evaluated: number }
  >();
  if (ids.length === 0) return counts;
  const rows = await prisma.assessmentAttempt.groupBy({
    by: [key, 'status', 'evaluationStatus'],
    where,
    _count: { _all: true },
  });
  for (const row of rows) {
    const id = (row as Record<string, unknown>)[key] as string;
    const entry = counts.get(id) ?? { total: 0, inProgress: 0, pendingEvaluation: 0, evaluated: 0 };
    entry.total += row._count._all;
    if (row.status === 'IN_PROGRESS') entry.inProgress += row._count._all;
    else if (row.evaluationStatus === 'PENDING') entry.pendingEvaluation += row._count._all;
    else entry.evaluated += row._count._all;
    counts.set(id, entry);
  }
  return counts;
}

export const emptyCounts = () => ({ total: 0, inProgress: 0, pendingEvaluation: 0, evaluated: 0 });

/** Turns a Prisma unique violation on attempt numbers into the documented 409. */
export function rethrowAttemptRace(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(
      'CONFLICT',
      'Another attempt was started at the same time. Reload and try again.',
    );
  }
  throw error;
}
