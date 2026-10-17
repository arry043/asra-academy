/**
 * Deterministic scoring of assessment attempts (docs/ASSESSMENTS.md §6). Pure functions, no I/O.
 *
 * All arithmetic is done in integer HUNDREDTHS of a mark ("cents"), so 0.25-mark penalties never
 * accumulate floating-point error. Inputs come from the attempt's frozen snapshot — never from the
 * client — and the result is the only source of the persisted score.
 *
 * Rules:
 *   - Unanswered question: 0 marks, no penalty.
 *   - SINGLE_CHOICE / TRUE_FALSE: correct ⇔ exactly the one correct option is selected.
 *   - MULTIPLE_CHOICE: ALL-OR-NOTHING — correct ⇔ the selection equals the set of correct options.
 *     No partial credit (pending client decision), so a question can never award more than its
 *     marks.
 *   - Wrong (answered, not correct) objective answer: penalty = negativeMarks when the assessment
 *     uses negative marking, else 0. Applied once per question.
 *   - SHORT_ANSWER: blank → 0 (evaluated automatically); answered → awaits manual marks 0…marks.
 *   - score = max(0, raw − penalties): the total is never negative.
 *   - percent = score ÷ max × 100, rounded half-up to 2 decimals.
 *   - passed ⇔ score ≥ passPercent % of max (inclusive, compared exactly in integers).
 */

export type ScoredQuestionType =
  'SINGLE_CHOICE' | 'TRUE_FALSE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';

export interface ScoringQuestion {
  type: ScoredQuestionType;
  /** Max marks, in hundredths. */
  marks: number;
  /** Penalty for a wrong answer, in hundredths. */
  negativeMarks: number;
  correctOptionIds: readonly string[];
  selectedOptionIds: readonly string[];
  textAnswer: string | null;
  /** Manual marks for SHORT_ANSWER, in hundredths (null = not graded yet). */
  manualMarks: number | null;
}

export interface QuestionOutcome {
  answered: boolean;
  /** null for an ungraded written answer. */
  isCorrect: boolean | null;
  awarded: number | null;
  penalty: number;
  pendingManual: boolean;
}

export interface AttemptScore {
  rawScore: number;
  penalty: number;
  score: number;
  maxScore: number;
  /** Hundredths of a percent (e.g. 6667 = 66.67 %). */
  percent: number;
  passed: boolean;
}

/** Converts marks (number or Decimal-like) to integer hundredths. */
export function toCents(value: number | { toString(): string }): number {
  return Math.round(Number(typeof value === 'number' ? value : value.toString()) * 100);
}

/** Integer hundredths → marks with at most two decimals. */
export function fromCents(cents: number): number {
  return cents / 100;
}

export function isAnswered(
  question: Pick<ScoringQuestion, 'type' | 'selectedOptionIds' | 'textAnswer'>,
) {
  return question.type === 'SHORT_ANSWER'
    ? (question.textAnswer ?? '').trim().length > 0
    : question.selectedOptionIds.length > 0;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function scoreQuestion(
  question: ScoringQuestion,
  negativeMarking: boolean,
): QuestionOutcome {
  const answered = isAnswered(question);
  if (question.type === 'SHORT_ANSWER') {
    if (!answered) {
      return { answered, isCorrect: false, awarded: 0, penalty: 0, pendingManual: false };
    }
    if (question.manualMarks === null) {
      return { answered, isCorrect: null, awarded: null, penalty: 0, pendingManual: true };
    }
    const awarded = Math.min(Math.max(question.manualMarks, 0), question.marks);
    return {
      answered,
      isCorrect: awarded === question.marks,
      awarded,
      penalty: 0,
      pendingManual: false,
    };
  }
  if (!answered) {
    return { answered, isCorrect: false, awarded: 0, penalty: 0, pendingManual: false };
  }
  const correct =
    question.type === 'MULTIPLE_CHOICE'
      ? sameSet(question.selectedOptionIds, question.correctOptionIds)
      : question.selectedOptionIds.length === 1 &&
        question.correctOptionIds.length === 1 &&
        question.selectedOptionIds[0] === question.correctOptionIds[0];
  return {
    answered,
    isCorrect: correct,
    awarded: correct ? question.marks : 0,
    penalty: correct || !negativeMarking ? 0 : Math.min(question.negativeMarks, question.marks),
    pendingManual: false,
  };
}

/** Half-up rounding of score/max × 100 to hundredths of a percent. */
export function percentOfMax(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.floor((score * 10_000 * 2 + maxScore) / (2 * maxScore));
}

export function hasPassed(score: number, maxScore: number, passPercent: number): boolean {
  return score * 100 >= passPercent * maxScore;
}

/**
 * Scores a whole attempt. Returns per-question outcomes and, when no written answer awaits
 * grading, the attempt score (otherwise `score` is null: the result is not final).
 */
export function scoreAttempt(
  questions: readonly ScoringQuestion[],
  options: { negativeMarking: boolean; passPercent: number },
): { outcomes: QuestionOutcome[]; pendingManual: boolean; score: AttemptScore | null } {
  const outcomes = questions.map((question) => scoreQuestion(question, options.negativeMarking));
  const maxScore = questions.reduce((sum, question) => sum + question.marks, 0);
  const pendingManual = outcomes.some((outcome) => outcome.pendingManual);
  if (pendingManual) return { outcomes, pendingManual, score: null };
  const rawScore = outcomes.reduce((sum, outcome) => sum + (outcome.awarded ?? 0), 0);
  const penalty = outcomes.reduce((sum, outcome) => sum + outcome.penalty, 0);
  const score = Math.max(0, rawScore - penalty);
  return {
    outcomes,
    pendingManual,
    score: {
      rawScore,
      penalty,
      score,
      maxScore,
      percent: percentOfMax(score, maxScore),
      passed: hasPassed(score, maxScore, options.passPercent),
    },
  };
}
