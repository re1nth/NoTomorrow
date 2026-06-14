import { describe, expect, it } from 'vitest';
import { Goal } from '../src/entities/goal.js';

const validGoal = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  title: 'Ship NoTomorrow MVP',
  motivation: 'Stop building tools to build tools.',
  horizon: '3m',
  targetDate: '2026-09-14',
  status: 'active',
  createdAt: '2026-06-14T12:00:00.000Z',
  updatedAt: '2026-06-14T12:00:00.000Z',
} as const;

describe('Goal schema', () => {
  it('accepts a well-formed goal', () => {
    expect(() => Goal.parse(validGoal)).not.toThrow();
  });

  it('rejects an unknown status', () => {
    const bad = { ...validGoal, status: 'crushed' };
    const result = Goal.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID id', () => {
    const bad = { ...validGoal, id: 'not-a-uuid' };
    const result = Goal.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported horizon', () => {
    const bad = { ...validGoal, horizon: '6m' };
    expect(Goal.safeParse(bad).success).toBe(false);
  });

  it('rejects extra unknown fields (strict)', () => {
    const bad = { ...validGoal, secretField: true };
    expect(Goal.safeParse(bad).success).toBe(false);
  });

  it('rejects a malformed targetDate', () => {
    const bad = { ...validGoal, targetDate: '2026/09/14' };
    expect(Goal.safeParse(bad).success).toBe(false);
  });
});
