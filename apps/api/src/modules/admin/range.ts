import { ANALYTICS_TIME_ZONE, type AnalyticsGranularity, type AnalyticsRange } from '@asra/types';
import {
  ANALYTICS_MAX_DAILY_DAYS,
  ANALYTICS_MAX_RANGE_DAYS,
  inclusiveDays,
} from '@asra/validation';
import { fieldError } from '../../utils/app-error.js';

/**
 * Calendar arithmetic for analytics (docs/ADMIN-DASHBOARD.md §5). Pure functions: the caller
 * passes `now`, so boundaries are tested at exact instants.
 *
 * Days are calendar days in the academy's zone (V-09: Asia/Kolkata, UTC+05:30, no daylight
 * saving), whatever the server's or the browser's zone. A day `D` covers the instants
 * [D 00:00 IST, D+1 00:00 IST). Buckets are computed in SQL with the same zone
 * (`date_trunc(unit, ts AT TIME ZONE 'Asia/Kolkata')`), so ISO weeks start on Monday.
 */

const ZONE_OFFSETS: Record<string, string> = { 'Asia/Kolkata': '+05:30' };
const OFFSET = ZONE_OFFSETS[ANALYTICS_TIME_ZONE]!;
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` of `instant` in the analytics zone. */
export function dayInZone(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** The instant day `day` begins in the analytics zone. */
export function zonedDayStart(day: string): Date {
  return new Date(`${day}T00:00:00${OFFSET}`);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `{ gte, lt }` instants of an inclusive day range (either end optional) — for list filters. */
export function zonedDayRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: zonedDayStart(from) } : {}),
    ...(to ? { lt: zonedDayStart(addDays(to, 1)) } : {}),
  };
}

export function defaultGranularity(days: number): AnalyticsGranularity {
  if (days <= 62) return 'day';
  if (days <= 366) return 'week';
  return 'month';
}

/** A resolved range with the instants every query uses. */
export interface ResolvedRange extends AnalyticsRange {
  start: Date;
  /** Exclusive. */
  end: Date;
  previousStart: Date;
  /** Exclusive (= `start`). */
  previousEnd: Date;
  days: number;
}

/**
 * Applies the defaults (last 30 days ending today) and re-checks what defaults can break: an
 * explicit `from` with the default `to` may still be too wide or in the future.
 */
export function resolveRange(
  query: { from?: string; to?: string; granularity?: AnalyticsGranularity },
  now: Date,
): ResolvedRange {
  const to = query.to ?? dayInZone(now);
  const from = query.from ?? addDays(to, -29);
  const days = inclusiveDays(from, to);
  if (days < 1) throw fieldError('VALIDATION_ERROR', 'from', '"From" must not be after "to"');
  if (days > ANALYTICS_MAX_RANGE_DAYS) {
    throw fieldError(
      'VALIDATION_ERROR',
      'from',
      `Choose a range of at most ${ANALYTICS_MAX_RANGE_DAYS} days`,
    );
  }
  const granularity = query.granularity ?? defaultGranularity(days);
  if (granularity === 'day' && days > ANALYTICS_MAX_DAILY_DAYS) {
    throw fieldError(
      'VALIDATION_ERROR',
      'granularity',
      `Daily grouping is available for up to ${ANALYTICS_MAX_DAILY_DAYS} days`,
    );
  }
  const previousFrom = addDays(from, -days);
  const previousTo = addDays(from, -1);
  return {
    from,
    to,
    granularity,
    timeZone: ANALYTICS_TIME_ZONE,
    previousFrom,
    previousTo,
    start: zonedDayStart(from),
    end: zonedDayStart(addDays(to, 1)),
    previousStart: zonedDayStart(previousFrom),
    previousEnd: zonedDayStart(from),
    days,
  };
}

/** The public part of a resolved range (no instants). */
export function publicRange(range: ResolvedRange): AnalyticsRange {
  const { from, to, granularity, timeZone, previousFrom, previousTo } = range;
  return { from, to, granularity, timeZone, previousFrom, previousTo };
}

/** First day of the bucket containing `day` (Monday for weeks, the 1st for months). */
export function bucketStart(day: string, granularity: AnalyticsGranularity): string {
  if (granularity === 'day') return day;
  if (granularity === 'month') return `${day.slice(0, 7)}-01`;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Every bucket start overlapping [from, to], in order — so empty periods appear as 0. */
export function bucketStarts(range: Pick<AnalyticsRange, 'from' | 'to' | 'granularity'>): string[] {
  const out: string[] = [];
  let cursor = bucketStart(range.from, range.granularity);
  while (cursor <= range.to) {
    out.push(cursor);
    if (range.granularity === 'day') cursor = addDays(cursor, 1);
    else if (range.granularity === 'week') cursor = addDays(cursor, 7);
    else {
      const [year, month] = cursor.split('-').map(Number) as [number, number];
      cursor =
        month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    }
  }
  return out;
}

/** Fills a sparse `{ period → value }` result into the full bucket list. */
export function fillSeries(
  range: Pick<AnalyticsRange, 'from' | 'to' | 'granularity'>,
  rows: { period: string; value: number }[],
): { period: string; value: number }[] {
  const byPeriod = new Map(rows.map((row) => [row.period, row.value]));
  return bucketStarts(range).map((period) => ({ period, value: byPeriod.get(period) ?? 0 }));
}

/** Floored percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.floor((part * 100) / whole) : null;
}
