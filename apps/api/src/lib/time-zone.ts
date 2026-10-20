/**
 * Server-side formatting of instants in a class's time zone (PHASE 11). Instants are stored in
 * UTC; every message and email names the zone explicitly so a reader in another zone is never
 * misled (V-09: the academy schedules in IST).
 */

const ZONE_LABELS: Record<string, string> = {
  'Asia/Kolkata': 'IST (UTC+05:30)',
};

export function timeZoneLabel(timeZone: string): string {
  return ZONE_LABELS[timeZone] ?? timeZone;
}

/** "Mon, 2 Nov 2026, 10:30 am IST (UTC+05:30)". */
export function formatInZone(instant: Date, timeZone: string): string {
  const text = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
  return `${text} ${timeZoneLabel(timeZone)}`;
}
