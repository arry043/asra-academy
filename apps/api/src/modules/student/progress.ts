import type { CourseProgressDto, LessonContentType } from '@asra/types';

/**
 * Progress rules (docs/STUDENT-LMS.md §4–5). Pure functions: no database, no clock of their own,
 * so the rules are unit-tested directly and every endpoint computes progress the same way.
 */

/**
 * Quiz and assignment lessons are instructions-only placeholders until the assessment engine
 * exists (PHASE 09). They cannot be completed by a click, so they are excluded from course
 * progress rather than holding every course below 100% (A-07 pending).
 */
const NON_PROGRESS_TYPES: ReadonlySet<LessonContentType> = new Set(['QUIZ', 'ASSIGNMENT']);

export function countsTowardProgress(contentType: LessonContentType): boolean {
  return !NON_PROGRESS_TYPES.has(contentType);
}

/**
 * Completion over the course's eligible lessons (PUBLISHED, counting types). Duplicate ids are
 * counted once; completions of lessons that are no longer eligible are ignored. Floors the
 * percentage so 100 means every lesson is done; `null` (not 0) when there is nothing to complete.
 */
export function calculateCourseProgress(
  eligibleLessonIds: readonly string[],
  completedLessonIds: ReadonlySet<string>,
  completedAt: Date | null,
): CourseProgressDto {
  const eligible = new Set(eligibleLessonIds);
  let completed = 0;
  for (const id of eligible) if (completedLessonIds.has(id)) completed += 1;
  const total = eligible.size;
  return {
    completedLessons: completed,
    totalLessons: total,
    percent: total === 0 ? null : Math.floor((completed * 100) / total),
    completedAt: completedAt?.toISOString() ?? null,
  };
}

export function isCourseComplete(progress: CourseProgressDto): boolean {
  return progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons;
}

// --- Video telemetry ------------------------------------------------------------------------

/** Share of the configured duration that must be credited before a video counts as watched. */
export const VIDEO_COMPLETION_RATIO = 0.9;
/** Credit allowed for the first heartbeat of a session (no previous heartbeat to measure from). */
export const FIRST_HEARTBEAT_CREDIT_SECONDS = 30;
/** Network/timer jitter tolerated between two heartbeats. */
const HEARTBEAT_SLACK_SECONDS = 2;
const MAX_VIDEO_SECONDS = 86_400;

export interface VideoState {
  watchedSeconds: number;
  heartbeatAt: Date | null;
}

export interface VideoCredit {
  watchedSeconds: number;
  positionSeconds: number;
  /** Credited playback reached the threshold of a configured duration. */
  reachedThreshold: boolean;
}

/**
 * Credits one heartbeat. The client's `playedSeconds` is never trusted on its own: credit is
 * bounded by the wall-clock time since the previous accepted heartbeat (so parallel tabs, replays
 * or forged requests cannot earn more than real time), and watched time is capped at the lesson's
 * configured duration. Seeking moves `positionSeconds` but earns nothing by itself. Without a
 * configured duration the threshold can never be reached — completion is not claimed without it.
 */
export function creditVideoHeartbeat(
  state: VideoState,
  input: { positionSeconds: number; playedSeconds: number },
  durationSeconds: number | null,
  now: Date,
): VideoCredit {
  const elapsed =
    state.heartbeatAt === null
      ? FIRST_HEARTBEAT_CREDIT_SECONDS
      : Math.max(0, (now.getTime() - state.heartbeatAt.getTime()) / 1000) + HEARTBEAT_SLACK_SECONDS;
  const credit = Math.floor(Math.max(0, Math.min(input.playedSeconds, elapsed)));
  const cap = durationSeconds && durationSeconds > 0 ? durationSeconds : MAX_VIDEO_SECONDS;
  const watchedSeconds = Math.min(state.watchedSeconds + credit, cap);
  const positionSeconds = Math.min(Math.max(0, Math.floor(input.positionSeconds)), cap);
  const reachedThreshold =
    durationSeconds !== null &&
    durationSeconds > 0 &&
    watchedSeconds >= Math.ceil(durationSeconds * VIDEO_COMPLETION_RATIO);
  return { watchedSeconds, positionSeconds, reachedThreshold };
}
