import type { AuthUser, LiveClassDto, SubmissionListItem } from '@asra/types';

/**
 * Pure helpers for the faculty portal (PHASE 08). No React, no fetching — shared by components
 * and the web tests. The API is the security boundary; nothing here decides access.
 */

export function isFaculty(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles.includes('FACULTY'));
}

export type CourseTab =
  'overview' | 'curriculum' | 'students' | 'assignments' | 'classes' | 'performance';

export const COURSE_TABS: readonly CourseTab[] = [
  'overview',
  'curriculum',
  'students',
  'assignments',
  'classes',
  'performance',
];

export function facultyCourseHref(courseId: string, tab?: CourseTab): string {
  const base = `/faculty/courses/${encodeURIComponent(courseId)}`;
  return tab && tab !== 'overview' ? `${base}?tab=${tab}` : base;
}

export function parseCourseTab(value: string | null | undefined): CourseTab {
  return COURSE_TABS.includes(value as CourseTab) ? (value as CourseTab) : 'overview';
}

// --- Time (V-09: the academy schedules in India Standard Time) ------------------------------

/** IST is UTC+05:30 all year (no daylight saving). */
const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = 330 * 60_000;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * `<input type="datetime-local">` value, read as IST → ISO instant with an explicit offset
 * ("2026-11-02T10:30" → "2026-11-02T10:30:00+05:30"). `null` for empty, `undefined` for invalid.
 * The browser's own time zone is deliberately ignored so every faculty member schedules in IST.
 */
export function istInputToIso(value: string): string | null | undefined {
  const text = value.trim();
  if (text === '') return null;
  const match = LOCAL_INPUT.exec(text);
  if (!match) return undefined;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return undefined;
  }
  return `${text}:00${IST_OFFSET}`;
}

/** ISO instant → the IST `datetime-local` value used to pre-fill an edit form. */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

// --- Labels ---------------------------------------------------------------------------------

export type ReviewState = 'AWAITING_REVIEW' | 'GRADED' | 'RELEASED';

export function reviewState(
  item: Pick<SubmissionListItem, 'status' | 'resultReleasedAt'>,
): ReviewState {
  if (item.resultReleasedAt) return 'RELEASED';
  return item.status === 'GRADED' ? 'GRADED' : 'AWAITING_REVIEW';
}

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  AWAITING_REVIEW: 'Awaiting review',
  GRADED: 'Graded — not released',
  RELEASED: 'Result released',
};

export const REVIEW_STATE_BADGE: Record<ReviewState, 'warning' | 'info' | 'success'> = {
  AWAITING_REVIEW: 'warning',
  GRADED: 'info',
  RELEASED: 'success',
};

/** "18 / 20" — or `null` without marks. */
export function formatMarks(marks: number | null | undefined, max: number): string | null {
  return marks === null || marks === undefined ? null : `${marks} / ${max}`;
}

/** "75%" or "—" for metrics that have no denominator yet (never a fabricated 0%). */
export function percentLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

/**
 * Where a class stands. There is deliberately no "live" state: no provider tells the platform
 * that a class is actually running, so it only says "scheduled" until it has ended. "completed"
 * means staff confirmed it was held (PHASE 11).
 */
export type ClassTiming = 'cancelled' | 'scheduled' | 'ended' | 'completed';

export function classTiming(
  item: Pick<LiveClassDto, 'status' | 'endsAt'>,
  now: number = Date.now(),
): ClassTiming {
  if (item.status === 'CANCELLED') return 'cancelled';
  if (item.status === 'COMPLETED') return 'completed';
  return new Date(item.endsAt).getTime() <= now ? 'ended' : 'scheduled';
}

export const CLASS_TIMING_LABELS: Record<ClassTiming, string> = {
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  ended: 'Ended',
  completed: 'Completed',
};

/** Staff may mark a scheduled class completed once it has started. */
export function canCompleteClass(
  item: Pick<LiveClassDto, 'status' | 'startsAt'>,
  now: number = Date.now(),
): boolean {
  return item.status === 'SCHEDULED' && new Date(item.startsAt).getTime() <= now;
}

/** Recording links can be added once a class has started, unless it was cancelled. */
export function canAddRecording(
  item: Pick<LiveClassDto, 'status' | 'startsAt'>,
  now: number = Date.now(),
): boolean {
  return item.status !== 'CANCELLED' && new Date(item.startsAt).getTime() <= now;
}

/** "Join" is offered only for a scheduled class that has not ended and has a link. */
export function canJoinClass(
  item: Pick<LiveClassDto, 'status' | 'endsAt' | 'joinUrl'>,
  now: number = Date.now(),
): boolean {
  return classTiming(item, now) === 'scheduled' && Boolean(item.joinUrl);
}

export const MEETING_PROVIDER_LABELS: Record<string, string> = {
  google_meet: 'Google Meet',
  manual: 'Meeting link',
};
