import { describe, expect, it } from 'vitest';
import { isoWeek, localDateString, localHour, localWeekday } from '../src/timezone.js';

describe('timezone helpers', () => {
  // 2026-06-14T14:00:00Z is 07:00 in America/Los_Angeles (PDT, UTC-7).
  const date = new Date('2026-06-14T14:00:00Z');

  it('extracts local hour across timezones', () => {
    expect(localHour(date, 'America/Los_Angeles')).toBe(7);
    expect(localHour(date, 'UTC')).toBe(14);
    expect(localHour(date, 'Asia/Tokyo')).toBe(23);
  });

  it('extracts local weekday (Sunday=0)', () => {
    // 2026-06-14 is a Sunday in UTC, still Sunday in LA.
    expect(localWeekday(date, 'America/Los_Angeles')).toBe(0);
    expect(localWeekday(date, 'UTC')).toBe(0);
  });

  it('formats local YYYY-MM-DD', () => {
    expect(localDateString(date, 'UTC')).toBe('2026-06-14');
    expect(localDateString(date, 'America/Los_Angeles')).toBe('2026-06-14');
  });

  it('produces ISO week labels', () => {
    expect(isoWeek(new Date('2026-01-05T00:00:00Z'))).toBe('2026-W02');
  });
});
