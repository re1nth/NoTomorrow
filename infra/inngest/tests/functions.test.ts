/**
 * Smoke tests for event → function dispatch and the function inner logic.
 *
 * We don't spin up `@inngest/test` (heavier dep); instead we assert two
 * things:
 *   1. Each function is registered against the right event/cron trigger.
 *   2. The handler bodies, when invoked through a hand-rolled `step`
 *      double, produce the expected DB + Coach calls.
 *
 * `inngest.createFunction` returns an `InngestFunction` object whose
 * trigger config is introspectable, which is what we lean on for (1).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  dailyCoachFanout,
  dailyCoachPerUser,
  __setCoachClientForTests as setDailyCoach,
} from '../src/functions/daily-coach.js';
import {
  weeklyRecalibrateFanout,
  weeklyRecalibratePerUser,
  __setCoachClientForTests as setWeeklyCoach,
} from '../src/functions/weekly-recalibrate.js';
import { streakDecay } from '../src/functions/streak-decay.js';
import {
  verifyProof,
  computeExpertiseDelta,
  __setCoachClientForTests as setVerifyCoach,
} from '../src/functions/verify-proof.js';
import { functions } from '../src/index.js';
import { setDbAdapter, defaultDbAdapter, type DbAdapter } from '../src/db.js';
import type { CoachClient } from '../src/coach-client.js';

const UUID = '33333333-3333-4333-8333-333333333333';

/** Minimal `step` test-double — just runs the inner fn and forwards results. */
function makeStep() {
  const sent: unknown[] = [];
  return {
    sent,
    api: {
      run: async <T>(_id: string, fn: () => Promise<T>) => fn(),
      sendEvent: async (_id: string, payload: unknown) => {
        sent.push(payload);
      },
    },
  };
}

function makeFakeDb(overrides: Partial<DbAdapter> = {}): DbAdapter {
  return {
    listAllUsers: vi.fn(async () => []),
    listActiveGoals: vi.fn(async () => []),
    getProofForVerification: vi.fn(async () => null),
    insertCoachMessage: vi.fn(async (msg) => ({
      id: UUID,
      sentAt: '2026-06-14T07:00:00.000Z',
      readAt: null,
      ...msg,
    })),
    insertRatingEvent: vi.fn(async (evt) => ({
      id: UUID,
      occurredAt: '2026-06-14T07:00:00.000Z',
      ...evt,
    })),
    insertProposedRoadmap: vi.fn(async (rm) => ({
      id: UUID,
      generatedAt: '2026-06-14T07:00:00.000Z',
      ...rm,
    })),
    decayStamina: vi.fn(async () => ({ rowsUpdated: 0 })),
    ...overrides,
  };
}

function makeFakeCoach(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    daily: vi.fn(async () => ({
      primaryTask: {
        id: UUID,
        milestoneId: UUID,
        title: 't',
        type: 'jab',
        estMinutes: 15,
        dueDate: '2026-06-14',
        status: 'pending',
      },
      stretchTask: null,
      coachLine: { body: 'go', tone: 'hype' },
    })),
    gradeProof: vi.fn(async () => ({ shipped: true, quality: 5, gaps: [] })),
    recalibrateRoadmap: vi.fn(async () => ({
      proposedRoadmap: {
        id: UUID,
        goalId: UUID,
        generatedAt: '2026-06-14T07:00:00.000Z',
        modelVersion: 'm',
        graph: [],
      },
      diff: { added: [], removed: [], retitled: [] },
      generatedAt: '2026-06-14T07:00:00.000Z',
    })),
    ...overrides,
  } as unknown as CoachClient;
}

beforeEach(() => {
  setDbAdapter(defaultDbAdapter());
  setDailyCoach(null);
  setWeeklyCoach(null);
  setVerifyCoach(null);
});

/** Reach into the InngestFunction internals to read its registered triggers. */
function getTriggers(fn: unknown): Array<{ event?: string; cron?: string }> {
  const opts = (fn as { opts?: { triggers?: Array<{ event?: string; cron?: string }> } }).opts;
  return opts?.triggers ?? [];
}

describe('function registration', () => {
  it('exports six functions covering every trigger', () => {
    expect(functions.length).toBe(6);
  });

  it('binds daily-coach-per-user to coach/daily.fanout', () => {
    expect(getTriggers(dailyCoachPerUser).some((t) => t.event === 'coach/daily.fanout')).toBe(true);
  });

  it('binds verify-proof to proof/submitted', () => {
    expect(getTriggers(verifyProof).some((t) => t.event === 'proof/submitted')).toBe(true);
  });

  it('binds streak-decay to an hourly cron', () => {
    expect(getTriggers(streakDecay).some((t) => t.cron === '0 * * * *')).toBe(true);
  });

  it('binds weekly-recalibrate-per-user to coach/weekly.fanout', () => {
    expect(
      getTriggers(weeklyRecalibratePerUser).some((t) => t.event === 'coach/weekly.fanout'),
    ).toBe(true);
  });
});

describe('daily-coach fan-out picks 07:00-local users only', () => {
  it('emits one event per due user', async () => {
    // Pick a time when LA is at 07:00 (14:00Z) and Tokyo is at 23:00.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T14:00:00Z'));

    const db = makeFakeDb({
      listAllUsers: vi.fn(async () => [
        { id: 'u-la', timezone: 'America/Los_Angeles' },
        { id: 'u-tokyo', timezone: 'Asia/Tokyo' },
      ]),
    });
    setDbAdapter(db);

    const step = makeStep();
    // The handler signature is ({ step, event, logger }) — pass what's used.
    const handler = (
      dailyCoachFanout as unknown as {
        fn: (ctx: { step: unknown; event?: unknown; logger?: unknown }) => Promise<unknown>;
      }
    ).fn;
    const result = (await handler({ step: step.api })) as { sent: number };

    expect(result.sent).toBe(1);
    expect(step.sent.length).toBe(1);
    const payload = step.sent[0] as Array<{ data: { userId: string } }>;
    expect(payload[0]?.data.userId).toBe('u-la');

    vi.useRealTimers();
  });
});

describe('daily-coach per-user persists a CoachMessage', () => {
  it('calls coach.daily and inserts the message', async () => {
    const db = makeFakeDb();
    setDbAdapter(db);
    const coach = makeFakeCoach();
    setDailyCoach(coach);

    const step = makeStep();
    const handler = (
      dailyCoachPerUser as unknown as {
        fn: (ctx: { step: unknown; event: { data: unknown } }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({
      step: step.api,
      event: { data: { userId: UUID, localDate: '2026-06-14' } },
    })) as { messageId: string; primaryTaskId: string };

    expect(res.messageId).toBe(UUID);
    expect(coach.daily).toHaveBeenCalledOnce();
    expect(db.insertCoachMessage).toHaveBeenCalledOnce();
  });
});

describe('verify-proof outcome branches', () => {
  it('writes a RatingEvent on pass', async () => {
    const db = makeFakeDb({
      getProofForVerification: vi.fn(async () => ({
        id: UUID,
        taskId: UUID,
        userId: UUID,
        domain: 'web-frontend',
        difficulty: 1200,
      })),
    });
    setDbAdapter(db);
    setVerifyCoach(makeFakeCoach());

    const step = makeStep();
    const handler = (
      verifyProof as unknown as {
        fn: (ctx: {
          step: unknown;
          event: { data: unknown };
          logger: { warn: (m: string) => void; error: (m: string) => void };
        }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({
      step: step.api,
      event: { data: { proofId: UUID, taskId: UUID, userId: UUID, submittedAt: '2026-06-14T07:00:00.000Z' } },
      logger: { warn: () => {}, error: () => {} },
    })) as { outcome: 'pass' | 'fail'; ratingEventId?: string };

    expect(res.outcome).toBe('pass');
    expect(res.ratingEventId).toBe(UUID);
    expect(db.insertRatingEvent).toHaveBeenCalledOnce();
  });

  it('writes a CoachMessage on fail', async () => {
    const db = makeFakeDb({
      getProofForVerification: vi.fn(async () => ({
        id: UUID,
        taskId: UUID,
        userId: UUID,
        domain: 'web-frontend',
        difficulty: 1200,
      })),
    });
    setDbAdapter(db);
    const coach = makeFakeCoach({
      gradeProof: vi.fn(async () => ({
        shipped: false,
        quality: 2,
        gaps: ['Add tests', 'Document API'],
      })),
    } as unknown as Partial<CoachClient>);
    setVerifyCoach(coach);

    const step = makeStep();
    const handler = (
      verifyProof as unknown as {
        fn: (ctx: {
          step: unknown;
          event: { data: unknown };
          logger: { warn: (m: string) => void; error: (m: string) => void };
        }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({
      step: step.api,
      event: { data: { proofId: UUID, taskId: UUID, userId: UUID, submittedAt: '2026-06-14T07:00:00.000Z' } },
      logger: { warn: () => {}, error: () => {} },
    })) as { outcome: 'pass' | 'fail'; coachMessageId?: string; gaps?: string[] };

    expect(res.outcome).toBe('fail');
    expect(res.coachMessageId).toBe(UUID);
    expect(res.gaps).toEqual(['Add tests', 'Document API']);
    expect(db.insertCoachMessage).toHaveBeenCalledOnce();
  });

  it('returns skipped when proof is missing without crashing', async () => {
    const db = makeFakeDb();
    setDbAdapter(db);
    setVerifyCoach(makeFakeCoach());

    const step = makeStep();
    const handler = (
      verifyProof as unknown as {
        fn: (ctx: {
          step: unknown;
          event: { data: unknown };
          logger: { warn: (m: string) => void; error: (m: string) => void };
        }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({
      step: step.api,
      event: { data: { proofId: UUID, taskId: UUID, userId: UUID, submittedAt: '2026-06-14T07:00:00.000Z' } },
      logger: { warn: () => {}, error: () => {} },
    })) as { skipped?: boolean };
    expect(res.skipped).toBe(true);
  });
});

describe('streak-decay', () => {
  it('hands the right window + floor to the DB adapter', async () => {
    const decay: DbAdapter['decayStamina'] = vi.fn(async () => ({ rowsUpdated: 42 }));
    setDbAdapter(makeFakeDb({ decayStamina: decay }));

    const step = makeStep();
    const handler = (
      streakDecay as unknown as { fn: (ctx: { step: unknown }) => Promise<unknown> }
    ).fn;
    const res = (await handler({ step: step.api })) as { rowsUpdated: number };

    expect(res.rowsUpdated).toBe(42);
    const decayMock = decay as unknown as ReturnType<typeof vi.fn>;
    expect(decayMock).toHaveBeenCalledOnce();
    const call = decayMock.mock.calls[0]?.[0] as
      | { inactiveSinceIso: string; decayPerHour: number; floor: number }
      | undefined;
    expect(call?.floor).toBe(800);
    expect(call?.decayPerHour).toBe(1);
    expect(typeof call?.inactiveSinceIso).toBe('string');
  });
});

describe('weekly-recalibrate per-user', () => {
  it('persists one proposed roadmap per active goal', async () => {
    const insertSpy = vi.fn(async (rm: unknown) => ({
      id: UUID,
      generatedAt: '2026-06-14T07:00:00.000Z',
      ...(rm as object),
    }));
    setDbAdapter(
      makeFakeDb({
        listActiveGoals: vi.fn(async () => [
          { id: 'g1', userId: UUID },
          { id: 'g2', userId: UUID },
        ]),
        insertProposedRoadmap: insertSpy as unknown as DbAdapter['insertProposedRoadmap'],
      }),
    );
    setWeeklyCoach(makeFakeCoach());

    const step = makeStep();
    const handler = (
      weeklyRecalibratePerUser as unknown as {
        fn: (ctx: { step: unknown; event: { data: unknown } }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({
      step: step.api,
      event: { data: { userId: UUID, isoWeek: '2026-W24' } },
    })) as { proposed: number };
    expect(res.proposed).toBe(2);
    expect(insertSpy).toHaveBeenCalledTimes(2);
  });
});

describe('weekly-recalibrate fan-out', () => {
  it('only fires on Sunday 20:00 local', async () => {
    // 2026-06-15T03:00Z is Sunday 20:00 in LA.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T03:00:00Z'));

    setDbAdapter(
      makeFakeDb({
        listAllUsers: vi.fn(async () => [
          { id: 'u-la', timezone: 'America/Los_Angeles' },
          { id: 'u-tokyo', timezone: 'Asia/Tokyo' }, // Monday 12:00 — not eligible
        ]),
      }),
    );

    const step = makeStep();
    const handler = (
      weeklyRecalibrateFanout as unknown as {
        fn: (ctx: { step: unknown }) => Promise<unknown>;
      }
    ).fn;
    const res = (await handler({ step: step.api })) as { sent: number };
    expect(res.sent).toBe(1);

    vi.useRealTimers();
  });
});

describe('computeExpertiseDelta', () => {
  it('rewards above-expected quality', () => {
    const delta = computeExpertiseDelta({ quality: 5, difficulty: 1200, expertise: 1200 });
    expect(delta).toBeGreaterThan(0);
  });

  it('penalises below-expected quality', () => {
    const delta = computeExpertiseDelta({ quality: 1, difficulty: 1200, expertise: 1200 });
    expect(delta).toBeLessThan(0);
  });
});
