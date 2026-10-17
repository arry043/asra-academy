import type {
  AnswerReveal,
  AssessmentStatus,
  AttemptResultState,
  AttemptScoreDto,
  AttemptStatus,
  ExamAvailability,
  QuestionType,
} from '@asra/types';

/**
 * Pure helpers for quizzes, examinations and attempts (PHASE 09). No React, no fetching — shared by
 * components and the web tests.
 *
 * IMPORTANT: nothing here decides acceptance. The countdown is a display aid computed from the
 * SERVER deadline and the server clock reported with each response; the API alone accepts or
 * refuses answers and submissions.
 */

// --- Time -----------------------------------------------------------------------------------

/**
 * Offset between the device clock and the server clock, measured when a response arrived:
 * `serverNow - localReceivedAt`. Adding it to `Date.now()` estimates the server's "now", so a
 * device whose clock is wrong still shows the right remaining time.
 */
export function clockSkewMs(serverNowIso: string, localReceivedAtMs: number): number {
  const server = Date.parse(serverNowIso);
  return Number.isFinite(server) ? server - localReceivedAtMs : 0;
}

/** Milliseconds left until the server deadline (never negative); null for untimed attempts. */
export function remainingMs(
  deadlineIso: string | null,
  skewMs: number,
  localNowMs: number,
): number | null {
  if (!deadlineIso) return null;
  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, deadline - (localNowMs + skewMs));
}

/** "1:05:09", "04:59", "00:00" — for the exam countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Visual urgency of the countdown (the server still decides). */
export function countdownTone(ms: number | null): 'normal' | 'warning' | 'critical' {
  if (ms === null) return 'normal';
  if (ms <= 60_000) return 'critical';
  if (ms <= 5 * 60_000) return 'warning';
  return 'normal';
}

// --- Answers --------------------------------------------------------------------------------

/** Next selection after a click: radio semantics for single-answer types, toggle for multi. */
export function toggleOption(
  type: QuestionType,
  selected: readonly string[],
  optionId: string,
): string[] {
  if (type === 'MULTIPLE_CHOICE') {
    return selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
  }
  return selected.length === 1 && selected[0] === optionId ? [] : [optionId];
}

export function isAnswered(answer: {
  type: QuestionType;
  selectedOptionIds: readonly string[];
  textAnswer: string | null;
}): boolean {
  return answer.type === 'SHORT_ANSWER'
    ? (answer.textAnswer ?? '').trim().length > 0
    : answer.selectedOptionIds.length > 0;
}

// --- Labels ---------------------------------------------------------------------------------

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Multiple choice (one answer)',
  TRUE_FALSE: 'True / False',
  MULTIPLE_CHOICE: 'Multiple answers',
  SHORT_ANSWER: 'Written answer',
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
};

export const ASSESSMENT_STATUS_BADGE: Record<
  AssessmentStatus,
  'secondary' | 'success' | 'outline'
> = {
  DRAFT: 'secondary',
  PUBLISHED: 'success',
  CLOSED: 'outline',
};

export const ANSWER_REVEAL_LABELS: Record<AnswerReveal, string> = {
  NEVER: 'Never show correct answers',
  AFTER_SUBMISSION: 'After the student’s result is visible',
  AFTER_CLOSE: 'After the quiz/exam closes',
};

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Time expired — auto-submitted',
};

export const RESULT_STATE_LABELS: Record<AttemptResultState, string> = {
  IN_PROGRESS: 'In progress',
  PENDING_EVALUATION: 'Awaiting evaluation',
  AWAITING_RELEASE: 'Result not published yet',
  RELEASED: 'Result available',
};

export const RESULT_STATE_BADGE: Record<
  AttemptResultState,
  'info' | 'warning' | 'secondary' | 'success'
> = {
  IN_PROGRESS: 'info',
  PENDING_EVALUATION: 'warning',
  AWAITING_RELEASE: 'secondary',
  RELEASED: 'success',
};

export const EXAM_AVAILABILITY_LABELS: Record<ExamAvailability, string> = {
  UPCOMING: 'Upcoming',
  OPEN: 'Open now',
  CLOSED: 'Closed',
};

/** "7.5 / 10" (marks keep up to two decimals, without trailing zeros). */
export function formatScore(score: number, max: number): string {
  return `${formatMarksValue(score)} / ${formatMarksValue(max)}`;
}

export function formatMarksValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

export function scoreSummary(result: AttemptScoreDto): string {
  return `${formatScore(result.score, result.maxScore)} · ${result.percent}% · ${result.passed ? 'Passed' : 'Not passed'}`;
}

/** "1 attempt" / "3 attempts". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
