import { describe, expect, it } from 'vitest';
import { RatingEvent } from '../src/entities/rating-event.js';

const valid = {
  id: '55555555-5555-4555-8555-555555555555',
  userId: '66666666-6666-4666-8666-666666666666',
  domain: 'ml-research',
  delta: { stamina: 3, expertise: -2 },
  reason: 'Graded proof: quality=4, on-time.',
  sourceProofId: '77777777-7777-4777-8777-777777777777',
  occurredAt: '2026-06-14T12:00:00.000Z',
};

describe('RatingEvent schema', () => {
  it('accepts a valid event', () => {
    expect(RatingEvent.safeParse(valid).success).toBe(true);
  });

  it('accepts a null sourceProofId (e.g. streak decay)', () => {
    const v = { ...valid, sourceProofId: null, reason: 'Streak decay tick.' };
    expect(RatingEvent.safeParse(v).success).toBe(true);
  });

  it('rejects a non-integer delta', () => {
    const v = { ...valid, delta: { stamina: 1.5, expertise: 0 } };
    expect(RatingEvent.safeParse(v).success).toBe(false);
  });

  it('rejects an empty reason', () => {
    const v = { ...valid, reason: '' };
    expect(RatingEvent.safeParse(v).success).toBe(false);
  });

  it('rejects missing delta fields', () => {
    const v = { ...valid, delta: { stamina: 1 } };
    expect(RatingEvent.safeParse(v).success).toBe(false);
  });
});
