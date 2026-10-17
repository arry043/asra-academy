/**
 * The single server-time source for time-sensitive business rules (assessment availability,
 * attempt deadlines, submission acceptance — docs/ASSESSMENTS.md §5). Services call `clock.now()`
 * instead of `new Date()` so the rules can be tested at exact instants without real-time sleeps.
 *
 * The browser's clock is never consulted: every timestamp that decides acceptance is produced
 * here, on the server, and persisted in UTC (`timestamptz`).
 */
let override: (() => Date) | null = null;

export const clock = {
  now(): Date {
    return override ? override() : new Date();
  },
};

/**
 * Pins (or, with `null`, releases) the clock. Test-only: throws outside NODE_ENV=test so a
 * production process can never be put on a fake time.
 */
export function setClockForTests(now: Date | (() => Date) | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setClockForTests is only available in tests');
  }
  if (now === null) override = null;
  else if (now instanceof Date) override = () => new Date(now.getTime());
  else override = now;
}
