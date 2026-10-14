/**
 * Display formatting shared by server and client components.
 *
 * Dates are always formatted in an explicit time zone so the server render and the browser
 * hydration produce identical text (no hydration mismatch). The academy operates in India, so
 * `Asia/Kolkata` is the default; per-user time zones can be passed in later.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const LOCALE = 'en-IN';

export type DateInput = Date | string | number;

/** Parses a date input; returns `null` for missing or invalid values instead of "Invalid Date". */
export function toValidDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14 Oct 2026, 4:30 pm" — or `null` when the value is missing/invalid. */
export function formatDateTime(
  value: DateInput | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
): string | null {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

/** "14 Oct 2026" — or `null` when the value is missing/invalid. */
export function formatDate(
  value: DateInput | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
): string | null {
  const date = toValidDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** "45 min", "1 hr", "1 hr 30 min" — or `null` for missing/non-positive values. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** True only for absolute http(s) URLs — guards external "Join" links against `javascript:` etc. */
export function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
