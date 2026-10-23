import type { AnalyticsGranularity, UserStatus } from '@asra/types';

/**
 * Pure helpers for the admin dashboard and analytics (PHASE 12). Numbers come from the API;
 * these only format them and build query strings — no metric is computed in the browser.
 */

const number = new Intl.NumberFormat('en-IN');

export function formatCount(value: number): string {
  return number.format(value);
}

/** "33%" — or an em dash when there is nothing to divide by (null from the API). */
export function formatPercent(value: number | null, digits = 0): string {
  return value === null ? '—' : `${value.toFixed(digits)}%`;
}

export interface Delta {
  /** "+12" / "−3" / "0". */
  text: string;
  direction: 'up' | 'down' | 'flat';
  /** Plain-language comparison for screen readers and tooltips. */
  description: string;
}

/**
 * Difference against the previous window. No percentage is invented when the previous window was
 * zero (a "+∞%" change is meaningless); the absolute difference is shown instead.
 */
export function compareCounts(current: number, previous: number, unit: string): Delta {
  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const text = diff > 0 ? `+${formatCount(diff)}` : diff < 0 ? `−${formatCount(-diff)}` : '0';
  return {
    text,
    direction,
    description: `${formatCount(current)} ${unit} vs ${formatCount(previous)} in the previous period`,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Axis/tooltip label of a bucket start ("2026-05-04"): "4 May", "Week of 4 May", "May 2026". */
export function periodLabel(
  period: string,
  granularity: AnalyticsGranularity,
  long = false,
): string {
  const [year, month, day] = period.split('-').map(Number) as [number, number, number];
  const monthName = MONTHS[month - 1] ?? '';
  if (granularity === 'month') return `${monthName} ${year}`;
  const short = `${day} ${monthName}`;
  if (granularity === 'week') return long ? `Week of ${short} ${year}` : short;
  return long ? `${short} ${year}` : short;
}

export interface RangeFilter {
  from: string;
  to: string;
  granularity: AnalyticsGranularity | '';
}

/** Query string of the shared analytics filter (empty values are omitted → server defaults). */
export function rangeQuery(
  filter: Partial<RangeFilter>,
  extra: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.granularity) params.set('granularity', filter.granularity);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** `YYYY-MM-DD` of `date` in the academy zone (Asia/Kolkata), matching the API's calendar. */
export function todayInAcademyZone(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export type RangePreset = '7d' | '30d' | '90d' | '12m';

export const RANGE_PRESETS: { value: RangePreset; label: string; days: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: '12m', label: 'Last 12 months', days: 365 },
];

export function presetRange(preset: RangePreset, today = todayInAcademyZone()): RangeFilter {
  const days = RANGE_PRESETS.find((item) => item.value === preset)!.days;
  return { from: shiftDay(today, -(days - 1)), to: today, granularity: '' };
}

export const USER_STATUS: Record<
  UserStatus,
  { label: string; tone: 'success' | 'warning' | 'destructive' }
> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'warning' },
  SUSPENDED: { label: 'Suspended', tone: 'destructive' },
};

export const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

export function roleLabel(key: string): string {
  return ROLE_LABELS[key] ?? key;
}

/** "user.status_changed" → "User status changed". */
export function auditActionLabel(action: string): string {
  const text = action.replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Nice upper bound for an axis: 0 → 1, 7 → 8, 130 → 150, 2400 → 2500. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
