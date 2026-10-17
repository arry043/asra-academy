import { PERMISSIONS, type QuestionDto } from '@asra/types';
import { QUESTION_LIMITS, type QuestionInput, type QuestionOrderInput } from '@asra/validation';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../database/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { accessPolicy } from '../../services/access-policy.service.js';
import type { AuthContext } from '../../types/auth.js';
import { AppError, fieldError } from '../../utils/app-error.js';
import { sourceQuestionSelect, type SourceQuestion } from './attempts.core.js';
import { fromCents, toCents } from './scoring.js';

/**
 * Question authoring shared by quizzes and examinations (docs/ASSESSMENTS.md §3). Questions can be
 * added, edited, removed and reordered only while their assessment is DRAFT: once students can
 * attempt it, the question set is frozen (and every attempt has its own snapshot anyway).
 */

export type QuestionOwner = { quizId: string } | { examinationId: string };

export interface OwnerContext {
  owner: QuestionOwner;
  courseId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  kind: 'QUIZ' | 'EXAM';
}

export function toQuestionDto(row: SourceQuestion): QuestionDto {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    explanation: row.explanation,
    marks: fromCents(toCents(row.marks)),
    negativeMarks: fromCents(toCents(row.negativeMarks)),
    position: row.position,
    options: row.options.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      position: option.position,
    })),
  };
}

export async function listQuestions(owner: QuestionOwner, db: DbClient = prisma) {
  const rows = await db.assessmentQuestion.findMany({
    where: owner,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: sourceQuestionSelect,
  });
  return rows.map(toQuestionDto);
}

/** Σ marks and count per owner, in one query. */
export async function questionTotals(
  where: Prisma.AssessmentQuestionWhereInput,
  by: 'quizId' | 'examinationId',
) {
  const rows = await prisma.assessmentQuestion.groupBy({
    by: [by],
    where,
    _count: { _all: true },
    _sum: { marks: true },
  });
  const totals = new Map<string, { count: number; marks: number }>();
  for (const row of rows) {
    const id = (row as Record<string, unknown>)[by] as string | null;
    if (!id) continue;
    totals.set(id, {
      count: row._count._all,
      marks: row._sum.marks ? fromCents(toCents(row._sum.marks)) : 0,
    });
  }
  return totals;
}

export function assertDraft(context: OwnerContext) {
  if (context.status !== 'DRAFT') {
    throw new AppError(
      'CONFLICT',
      `Questions can only be changed while the ${context.kind === 'QUIZ' ? 'quiz' : 'exam'} is a draft. Unpublish it first (possible only before anyone has attempted it).`,
    );
  }
}

function assertTypeAllowed(context: OwnerContext, input: QuestionInput) {
  if (context.kind === 'QUIZ' && input.type === 'SHORT_ANSWER') {
    throw fieldError(
      'VALIDATION_ERROR',
      'type',
      'Quizzes are scored automatically, so written answers are only available in examinations.',
    );
  }
}

async function lockOwner(tx: DbClient, owner: QuestionOwner) {
  if ('quizId' in owner) {
    await tx.$queryRaw`SELECT "id" FROM "quizzes" WHERE "id" = ${owner.quizId}::uuid FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT "id" FROM "examinations" WHERE "id" = ${owner.examinationId}::uuid FOR UPDATE`;
  }
}

const optionRows = (input: QuestionInput) =>
  input.options.map((option, position) => ({
    text: option.text,
    isCorrect: option.isCorrect,
    position,
  }));

export const questionAuthoring = {
  /**
   * Appends a question. `resolve` re-reads the owner INSIDE the transaction after locking it, so a
   * concurrent publish cannot slip a question into a published assessment.
   */
  async add(
    resolve: (tx: DbClient) => Promise<OwnerContext>,
    input: QuestionInput,
  ): Promise<QuestionDto> {
    return prisma.$transaction(async (tx) => {
      const context = await resolve(tx);
      await lockOwner(tx, context.owner);
      const fresh = await resolve(tx);
      assertDraft(fresh);
      assertTypeAllowed(fresh, input);
      const count = await tx.assessmentQuestion.count({ where: fresh.owner });
      if (count >= QUESTION_LIMITS.questionsPerAssessment) {
        throw new AppError(
          'CONFLICT',
          `An assessment can have at most ${QUESTION_LIMITS.questionsPerAssessment} questions.`,
        );
      }
      const created = await tx.assessmentQuestion.create({
        data: {
          ...fresh.owner,
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation ?? null,
          marks: new Prisma.Decimal(input.marks.toFixed(2)),
          negativeMarks: new Prisma.Decimal(input.negativeMarks.toFixed(2)),
          position: count,
          options: { create: optionRows(input) },
        },
        select: sourceQuestionSelect,
      });
      return toQuestionDto(created);
    });
  },

  /** Replaces a question's content and options (DRAFT only). */
  async update(auth: AuthContext, questionId: string, input: QuestionInput): Promise<QuestionDto> {
    return prisma.$transaction(async (tx) => {
      const context = await resolveQuestionOwner(auth, questionId, tx);
      await lockOwner(tx, context.owner);
      assertDraft(await resolveQuestionOwner(auth, questionId, tx));
      assertTypeAllowed(context, input);
      await tx.assessmentQuestionOption.deleteMany({ where: { questionId } });
      const updated = await tx.assessmentQuestion.update({
        where: { id: questionId },
        data: {
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation ?? null,
          marks: new Prisma.Decimal(input.marks.toFixed(2)),
          negativeMarks: new Prisma.Decimal(input.negativeMarks.toFixed(2)),
          options: { create: optionRows(input) },
        },
        select: sourceQuestionSelect,
      });
      return toQuestionDto(updated);
    });
  },

  /** Removes a question and closes the gap in positions (DRAFT only). */
  async remove(auth: AuthContext, questionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const context = await resolveQuestionOwner(auth, questionId, tx);
      await lockOwner(tx, context.owner);
      assertDraft(await resolveQuestionOwner(auth, questionId, tx));
      await tx.assessmentQuestion.delete({ where: { id: questionId } });
      const rest = await tx.assessmentQuestion.findMany({
        where: context.owner,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, position: true },
      });
      await Promise.all(
        rest.map((row, position) =>
          row.position === position
            ? null
            : tx.assessmentQuestion.update({ where: { id: row.id }, data: { position } }),
        ),
      );
    });
  },

  /** Applies a complete new order: the list must contain every question exactly once. */
  async reorder(
    resolve: (tx: DbClient) => Promise<OwnerContext>,
    input: QuestionOrderInput,
  ): Promise<QuestionDto[]> {
    return prisma.$transaction(async (tx) => {
      const context = await resolve(tx);
      await lockOwner(tx, context.owner);
      assertDraft(await resolve(tx));
      const current = await tx.assessmentQuestion.findMany({
        where: context.owner,
        select: { id: true },
      });
      const known = new Set(current.map((row) => row.id));
      if (
        input.questionIds.length !== current.length ||
        input.questionIds.some((id) => !known.has(id))
      ) {
        throw fieldError(
          'VALIDATION_ERROR',
          'questionIds',
          'Send every question of this assessment exactly once',
        );
      }
      await Promise.all(
        input.questionIds.map((id, position) =>
          tx.assessmentQuestion.update({ where: { id }, data: { position } }),
        ),
      );
      return listQuestions(context.owner, tx);
    });
  },
};

/** Resolves a question's assessment and course, and checks the caller authors for that course. */
export async function resolveQuestionOwner(
  auth: AuthContext,
  questionId: string,
  db: DbClient = prisma,
): Promise<OwnerContext> {
  const row = await db.assessmentQuestion.findUnique({
    where: { id: questionId },
    select: {
      quiz: {
        select: {
          id: true,
          status: true,
          lesson: { select: { chapter: { select: { module: { select: { courseId: true } } } } } },
        },
      },
      examination: { select: { id: true, status: true, courseId: true } },
    },
  });
  if (!row) throw new AppError('NOT_FOUND', 'Question not found');
  const context: OwnerContext = row.quiz
    ? {
        owner: { quizId: row.quiz.id },
        courseId: row.quiz.lesson.chapter.module.courseId,
        status: row.quiz.status,
        kind: 'QUIZ',
      }
    : {
        owner: { examinationId: row.examination!.id },
        courseId: row.examination!.courseId,
        status: row.examination!.status,
        kind: 'EXAM',
      };
  await accessPolicy.assertTeachesCourse(
    auth,
    context.courseId,
    PERMISSIONS.CONTENT_MANAGE_ASSIGNED,
    db,
  );
  return context;
}
