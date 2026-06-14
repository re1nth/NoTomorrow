import { describe, expect, it } from 'vitest';
import {
  ProofSubmittedEvent,
  MilestoneClearedEvent,
  GoalCreatedEvent,
  TrainingLoggedEvent,
  InngestEvent,
} from '../src/events.js';

const UUID = '11111111-1111-4111-8111-111111111111';
const ISO = '2026-06-14T07:00:00.000Z';

describe('event payload schemas', () => {
  it('accepts a well-formed proof.submitted', () => {
    const result = ProofSubmittedEvent.safeParse({
      name: 'proof/submitted',
      data: { proofId: UUID, taskId: UUID, userId: UUID, submittedAt: ISO },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown extra key on milestone.cleared', () => {
    const result = MilestoneClearedEvent.safeParse({
      name: 'milestone/cleared',
      data: {
        milestoneId: UUID,
        goalId: UUID,
        userId: UUID,
        clearedAt: ISO,
        extra: 'nope',
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts goal.created and training.logged', () => {
    expect(
      GoalCreatedEvent.safeParse({
        name: 'goal/created',
        data: { goalId: UUID, userId: UUID, createdAt: ISO },
      }).success,
    ).toBe(true);

    expect(
      TrainingLoggedEvent.safeParse({
        name: 'training/logged',
        data: { trainingLogId: UUID, userId: UUID, loggedAt: ISO },
      }).success,
    ).toBe(true);
  });

  it('narrows the discriminated union by name', () => {
    const parsed = InngestEvent.parse({
      name: 'proof/submitted',
      data: { proofId: UUID, taskId: UUID, userId: UUID, submittedAt: ISO },
    });
    expect(parsed.name).toBe('proof/submitted');
  });
});
