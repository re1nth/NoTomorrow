/**
 * Small timezone helpers used by the per-user cron fan-outs.
 *
 * We don't pull in date-fns / luxon — the only thing we need is "given an
 * IANA timezone, what is the user's local hour and weekday right now?" and
 * `Intl.DateTimeFormat` already does that natively.
 */

/** Returns the user's local hour (0..23) for the given IANA tz. */
export function localHour(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  if (!hourPart) throw new Error(`Could not extract hour for tz=${timezone}`);
  // `en-US` h24 sometimes formats midnight as "24" — normalise to 0.
  const h = Number.parseInt(hourPart.value, 10);
  return h === 24 ? 0 : h;
}

/**
 * Returns the user's local weekday (0=Sun..6=Sat).
 */
export function localWeekday(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const day = fmt.format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    day as 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  ];
}

/** YYYY-MM-DD in the given timezone. */
export function localDateString(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

/** ISO week label (YYYY-Www) in UTC — used for weekly recalibration tags. */
export function isoWeek(date: Date): string {
  // Implementation copied from ISO 8601 reference (no external dep needed).
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
