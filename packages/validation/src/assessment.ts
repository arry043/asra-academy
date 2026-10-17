import { z } from 'zod';
import { optionalTextSchema, paginationQuerySchema } from './common.js';
import { curriculumTitleSchema } from './curriculum.js';
import { isoInstantSchema } from './faculty.js';

/**
 * Assessment engine (PHASE 09) request schemas, shared by the API and the portals. Rules:
 * docs/ASSESSMENTS.md. Every body is `.strict()`: a client can never send a start time, deadline,
 * attempt number, score, correctness flag or reviewer — unknown keys are a 422.
 *
 * Units: durations in whole MINUTES; marks in points with at most two decimals; percentages are
 * whole percent 0–100. Bounds mirror the CHECK constraints of migration
 * 20261017090000_phase09_assessment_engine.
 */

export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'TRUE_FALSE',
  'MULTIPLE_CHOICE',
  'SHORT_ANSWER',
] as const;
export const OBJECTIVE_QUESTION_TYPES = ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'] as const;
export const ANSWER_REVEALS = ['NEVER', 'AFTER_SUBMISSION', 'AFTER_CLOSE'] as const;

export const QUIZ_LIMITS = {
  timeLimitMinutes: { min: 1, max: 300 },
  maxAttempts: { min: 1, max: 20 },
  questionsPerAttempt: { min: 1, max: 200 },
} as const;

export const EXAM_LIMITS = {
  durationMinutes: { min: 1, max: 600 },
  maxAttempts: { min: 1, max: 5 },
} as const;

export const QUESTION_LIMITS = {
  marks: { min: 0.25, max: 100 },
  options: { min: 2, max: 10 },
  promptLength: 10_000,
  optionLength: 1000,
  questionsPerAssessment: 200,
} as const;

/** Written answers to SHORT_ANSWER questions. */
export const TEXT_ANSWER_MAX_LENGTH = 10_000;

/** True when `value` has at most two decimals (marks are stored as DECIMAL(…,2)). */
export function hasTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

const marksSchema = z
  .number({ message: 'Enter the marks' })
  .min(QUESTION_LIMITS.marks.min, `At least ${QUESTION_LIMITS.marks.min}`)
  .max(QUESTION_LIMITS.marks.max, `At most ${QUESTION_LIMITS.marks.max}`)
  .refine(hasTwoDecimals, 'Use at most two decimals');

const negativeMarksSchema = z
  .number({ message: 'Enter the negative marks (0 for none)' })
  .min(0, 'Cannot be negative')
  .max(QUESTION_LIMITS.marks.max)
  .refine(hasTwoDecimals, 'Use at most two decimals');

const passPercentSchema = z
  .number({ message: 'Enter the pass mark' })
  .int('Use a whole percentage')
  .min(0, 'At least 0%')
  .max(100, 'At most 100%');

const intIn = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .number({ message: `Enter the ${label}` })
    .int(`Use a whole number`)
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`);

// --- Questions ------------------------------------------------------------------------------

const optionSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, 'Write the option text')
      .max(
        QUESTION_LIMITS.optionLength,
        `Must be at most ${QUESTION_LIMITS.optionLength} characters`,
      ),
    isCorrect: z.boolean(),
  })
  .strict();

/**
 * One question. Options are required for choice types and forbidden for SHORT_ANSWER:
 *   SINGLE_CHOICE   2–10 options, exactly one correct
 *   TRUE_FALSE      exactly 2 options, exactly one correct
 *   MULTIPLE_CHOICE 2–10 options, at least one correct
 *   SHORT_ANSWER    no options (manual grading; examinations only — checked by the API)
 */
export const questionInputSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    prompt: z
      .string()
      .trim()
      .min(1, 'Write the question')
      .max(
        QUESTION_LIMITS.promptLength,
        `Must be at most ${QUESTION_LIMITS.promptLength} characters`,
      ),
    explanation: optionalTextSchema(5000),
    marks: marksSchema,
    negativeMarks: negativeMarksSchema.default(0),
    options: z.array(optionSchema).max(QUESTION_LIMITS.options.max).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.negativeMarks > value.marks) {
      ctx.addIssue({
        code: 'custom',
        path: ['negativeMarks'],
        message: 'Negative marks cannot exceed the marks for a correct answer',
      });
    }
    const correct = value.options.filter((option) => option.isCorrect).length;
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['options'], message });
    if (value.type === 'SHORT_ANSWER') {
      if (value.options.length > 0) issue('Written-answer questions have no options');
      if (value.negativeMarks > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['negativeMarks'],
          message: 'Negative marking does not apply to written answers',
        });
      }
      return;
    }
    if (value.type === 'TRUE_FALSE' && value.options.length !== 2) {
      return issue('True/False questions have exactly two options');
    }
    if (value.options.length < QUESTION_LIMITS.options.min) {
      return issue(`Add at least ${QUESTION_LIMITS.options.min} options`);
    }
    const texts = value.options.map((option) => option.text.toLowerCase());
    if (new Set(texts).size !== texts.length) issue('Options must be different from each other');
    if (value.type === 'MULTIPLE_CHOICE') {
      if (correct < 1) issue('Mark at least one correct option');
    } else if (correct !== 1) {
      issue('Mark exactly one correct option');
    }
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** The complete new order of an assessment's questions (every question id exactly once). */
export const questionOrderSchema = z
  .object({
    questionIds: z
      .array(z.uuid())
      .min(1)
      .max(QUESTION_LIMITS.questionsPerAssessment)
      .refine((ids) => new Set(ids).size === ids.length, 'Each question may appear only once'),
  })
  .strict();
export type QuestionOrderInput = z.infer<typeof questionOrderSchema>;

// --- Quizzes --------------------------------------------------------------------------------

const quizRuleFields = {
  timeLimitMinutes: intIn('time limit', QUIZ_LIMITS.timeLimitMinutes).nullable(),
  maxAttempts: intIn('number of attempts', QUIZ_LIMITS.maxAttempts),
  passPercent: passPercentSchema,
  negativeMarking: z.boolean(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  questionsPerAttempt: intIn('number of questions', QUIZ_LIMITS.questionsPerAttempt).nullable(),
  showResultImmediately: z.boolean(),
  answerReveal: z.enum(ANSWER_REVEALS),
};

export const QUIZ_DEFAULT_RULES = {
  timeLimitMinutes: null,
  maxAttempts: 1,
  passPercent: 40,
  negativeMarking: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  questionsPerAttempt: null,
  showResultImmediately: true,
  answerReveal: 'AFTER_CLOSE',
} as const satisfies { [K in keyof typeof quizRuleFields]: z.infer<(typeof quizRuleFields)[K]> };

/** Full rule set of a quiz (create or replace while DRAFT). */
export const quizSettingsSchema = z.object(quizRuleFields).strict();
export type QuizSettingsInput = z.infer<typeof quizSettingsSchema>;

/** Creates a QUIZ lesson (DRAFT) and its quiz in one step. */
export const quizCreateSchema = z
  .object({
    title: curriculumTitleSchema,
    instructions: optionalTextSchema(50_000),
    ...quizRuleFields,
  })
  .strict();
export type QuizCreateInput = z.infer<typeof quizCreateSchema>;

export const facultyQuizListQuerySchema = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
});
export type FacultyQuizListQuery = z.infer<typeof facultyQuizListQuerySchema>;

// --- Examinations ---------------------------------------------------------------------------

const examFields = {
  title: curriculumTitleSchema,
  instructions: optionalTextSchema(50_000),
  opensAt: isoInstantSchema,
  closesAt: isoInstantSchema,
  durationMinutes: intIn('duration in minutes', EXAM_LIMITS.durationMinutes),
  maxAttempts: intIn('number of attempts', EXAM_LIMITS.maxAttempts),
  passPercent: passPercentSchema,
  negativeMarking: z.boolean(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  answerReveal: z.enum(ANSWER_REVEALS),
};

const windowIssue = (value: { opensAt?: string; closesAt?: string }, ctx: z.RefinementCtx) => {
  if (value.opensAt && value.closesAt && new Date(value.closesAt) <= new Date(value.opensAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['closesAt'],
      message: 'The exam must close after it opens',
    });
  }
};

export const examCreateSchema = z.object(examFields).strict().superRefine(windowIssue);
export type ExamCreateInput = z.infer<typeof examCreateSchema>;

/** Changes to a DRAFT examination (the server re-checks the window against stored values). */
export const examUpdateSchema = z
  .object(examFields)
  .partial()
  .strict()
  .superRefine(windowIssue)
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;

export const facultyExamListQuerySchema = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
});
export type FacultyExamListQuery = z.infer<typeof facultyExamListQuerySchema>;

// --- Lifecycle ------------------------------------------------------------------------------

/**
 * DRAFT → PUBLISHED (publish), PUBLISHED → CLOSED (close), CLOSED → PUBLISHED (reopen),
 * PUBLISHED → DRAFT (unpublish; only before anyone has attempted it).
 */
export const ASSESSMENT_TRANSITIONS = ['publish', 'close', 'reopen', 'unpublish'] as const;
export type AssessmentTransition = (typeof ASSESSMENT_TRANSITIONS)[number];

export const assessmentTransitionSchema = z
  .object({ action: z.enum(ASSESSMENT_TRANSITIONS) })
  .strict();
export type AssessmentTransitionInput = z.infer<typeof assessmentTransitionSchema>;

// --- Attempts -------------------------------------------------------------------------------

export const ATTEMPT_FILTERS = ['IN_PROGRESS', 'PENDING_EVALUATION', 'EVALUATED'] as const;

export const attemptListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ATTEMPT_FILTERS).optional(),
});
export type AttemptListQuery = z.infer<typeof attemptListQuerySchema>;

/**
 * Autosave of one answer. `sequence` increases with every change made in the browser; the server
 * ignores a save whose sequence is not higher than the one already stored (late retries cannot
 * overwrite a newer answer). An empty selection / null text clears the answer.
 */
export const answerSaveSchema = z
  .object({
    selectedOptionIds: z
      .array(z.uuid())
      .max(QUESTION_LIMITS.options.max)
      .refine((ids) => new Set(ids).size === ids.length, 'An option can be chosen once')
      .optional(),
    textAnswer: z
      .string()
      .max(TEXT_ANSWER_MAX_LENGTH, `Must be at most ${TEXT_ANSWER_MAX_LENGTH} characters`)
      .nullable()
      .optional(),
    sequence: z.number().int().min(1).max(2_147_483_647),
  })
  .strict()
  .refine(
    (value) => (value.selectedOptionIds === undefined) !== (value.textAnswer === undefined),
    'Send either selectedOptionIds or textAnswer',
  );
export type AnswerSaveInput = z.infer<typeof answerSaveSchema>;

/** Submitting takes no input: the server evaluates the answers it has already stored. */
export const attemptSubmitSchema = z.object({}).strict();

/** Manual grading of one written answer. */
export const answerGradeSchema = z
  .object({
    awardedMarks: z
      .number({ message: 'Enter the marks' })
      .min(0, 'Marks cannot be negative')
      .max(QUESTION_LIMITS.marks.max)
      .refine(hasTwoDecimals, 'Use at most two decimals'),
    feedback: optionalTextSchema(5000),
  })
  .strict();
export type AnswerGradeInput = z.infer<typeof answerGradeSchema>;

export const studentExamListQuerySchema = paginationQuerySchema.extend({
  when: z.enum(['current', 'past']).default('current'),
});
export type StudentExamListQuery = z.infer<typeof studentExamListQuerySchema>;
