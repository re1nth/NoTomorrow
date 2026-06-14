/**
 * Timezone helpers used by API routes. Mirror of `infra/inngest/timezone.ts`
 * but re-implemented here so the web app doesn't depend on inngest internals
 * for date math.
 */

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateString(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

/** Today's local date for the user. */
export function todayInTz(timezone: string): string {
  return localDateString(new Date(), timezone);
}
