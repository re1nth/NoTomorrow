/**
 * Test setup. Forces NODE_ENV=test before any module reads env, stubs the DB
 * with a tiny in-memory fake, and provides helpers for switching the "signed
 * in" user.
 *
 * The tests focus on the pure-logic edges of the API routes — full HTTP
 * round-trips against Next's request lifecycle are out of scope here; we
 * import the route handler functions directly and feed them `Request`
 * objects.
 */
import { vi, beforeEach } from 'vitest';

(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).VITEST = 'true';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.COACH_SERVICE_URL = 'http://localhost:8001';
process.env.COACH_SERVICE_TOKEN = 'test';

// In-memory DB fake. Each test resets the per-table arrays via beforeEach.
export interface DbState {
  users: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  roadmaps: Array<Record<string, unknown>>;
  milestones: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  proofs: Array<Record<string, unknown>>;
  trainingLogs: Array<Record<string, unknown>>;
  coachMessages: Array<Record<string, unknown>>;
  ratingProfiles: Array<Record<string, unknown>>;
  ratingEvents: Array<Record<string, unknown>>;
}

export const state: DbState = {
  users: [],
  goals: [],
  roadmaps: [],
  milestones: [],
  tasks: [],
  proofs: [],
  trainingLogs: [],
  coachMessages: [],
  ratingProfiles: [],
  ratingEvents: [],
};

function reset() {
  state.users = [];
  state.goals = [];
  state.roadmaps = [];
  state.milestones = [];
  state.tasks = [];
  state.proofs = [];
  state.trainingLogs = [];
  state.coachMessages = [];
  state.ratingProfiles = [];
  state.ratingEvents = [];
  delete (globalThis as { __testUserId?: string }).__testUserId;
}

beforeEach(reset);

function inferTableName(t: unknown): string {
  if (typeof t !== 'object' || t === null) return '';
  const sym = Object.getOwnPropertySymbols(t).find(
    (s) => s.description === 'drizzle:Name',
  );
  if (!sym) return '';
  const value = (t as Record<symbol, unknown>)[sym];
  return typeof value === 'string' ? value : '';
}

function rowsFor(tableName: string): Array<Record<string, unknown>> {
  switch (tableName) {
    case 'goals':
      return state.goals;
    case 'roadmaps':
      return state.roadmaps;
    case 'milestones':
      return state.milestones;
    case 'tasks':
      return state.tasks;
    case 'proofs_of_work':
      return state.proofs;
    case 'training_logs':
      return state.trainingLogs;
    case 'users':
      return state.users;
    case 'coach_messages':
      return state.coachMessages;
    case 'rating_profiles':
      return state.ratingProfiles;
    case 'rating_events':
      return state.ratingEvents;
    default:
      return [];
  }
}

// Stub `@/lib/db` — every route imports `db` from here so this is the seam.
vi.mock('@/lib/db', () => {
  const idCounter = { n: 100 };
  const newId = () => {
    idCounter.n += 1;
    return `00000000-0000-4000-8000-${idCounter.n.toString(16).padStart(12, '0')}`;
  };

  /**
   * A chain object that is also a thenable so it can be awaited at any
   * stage (Drizzle queries return a thenable that resolves to rows).
   */
  function chain(rows: Array<Record<string, unknown>>): PromiseLike<unknown[]> & {
    where: (..._args: unknown[]) => ReturnType<typeof chain>;
    orderBy: (..._args: unknown[]) => ReturnType<typeof chain>;
    limit: (..._args: unknown[]) => ReturnType<typeof chain>;
  } {
    const out = {
      where: () => chain(rows),
      orderBy: () => chain(rows),
      limit: () => chain(rows),
      then: (
        onFulfilled?: (value: unknown[]) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return out as unknown as PromiseLike<unknown[]> & {
      where: (..._args: unknown[]) => ReturnType<typeof chain>;
      orderBy: (..._args: unknown[]) => ReturnType<typeof chain>;
      limit: (..._args: unknown[]) => ReturnType<typeof chain>;
    };
  }

  const finders = {
    users: { findFirst: async () => state.users[0] ?? null },
    goals: { findFirst: async () => state.goals[0] ?? null },
    roadmaps: { findFirst: async () => state.roadmaps[0] ?? null },
    milestones: { findFirst: async () => state.milestones[0] ?? null },
    tasks: {
      findFirst: async () => {
        // Tests stash a task with id 't1'; return it.
        return state.tasks[0] ?? null;
      },
    },
    coachMessages: { findFirst: async () => state.coachMessages[0] ?? null },
    ratingProfiles: { findFirst: async () => state.ratingProfiles[0] ?? null },
  };

  const db = {
    query: finders,
    select: (_cols?: unknown) => ({
      from: (t: unknown) => {
        const name = inferTableName(t);
        return chain(rowsFor(name).slice());
      },
    }),
    insert: (t: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        const tableName = inferTableName(t);
        const row: Record<string, unknown> = { id: newId(), ...vals };
        if (tableName === 'proofs_of_work') {
          row.submittedAt = new Date().toISOString();
        }
        let persisted = false;
        const persist = () => {
          if (persisted) return;
          rowsFor(tableName).push(row);
          persisted = true;
        };
        const inserted = {
          returning: async () => {
            persist();
            return [row];
          },
          onConflictDoUpdate: () => ({
            returning: async () => {
              persist();
              return [row];
            },
          }),
          then: (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => {
            persist();
            return Promise.resolve(undefined).then(onFulfilled, onRejected);
          },
        };
        return inserted;
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: async () => [{}] }),
      }),
    }),
    delete: () => ({ where: () => ({}) }),
  };
  return { db };
});

// Stub `@/lib/auth` so route handlers can be invoked without a real session.
vi.mock('@/lib/auth', async () => {
  class UnauthorizedError extends Error {
    override readonly name = 'UnauthorizedError';
  }
  return {
    UnauthorizedError,
    DEMO_USER_ID: '00000000-0000-7000-8000-000000000001',
    async getUserId() {
      return (globalThis as { __testUserId?: string }).__testUserId ?? null;
    },
    async requireUser() {
      const id = (globalThis as { __testUserId?: string }).__testUserId;
      if (!id) throw new UnauthorizedError('not authenticated');
      return { id, timezone: 'UTC' };
    },
    async requireUserOrTest() {
      const id = (globalThis as { __testUserId?: string }).__testUserId;
      if (!id) throw new UnauthorizedError('not authenticated');
      return { id, timezone: 'UTC' };
    },
  };
});

// Stub `@/lib/inngest` so `inngest.send(...)` is a no-op in tests.
vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: async () => undefined,
  },
  functions: [],
}));

export function signInAs(userId: string) {
  (globalThis as { __testUserId?: string }).__testUserId = userId;
}
