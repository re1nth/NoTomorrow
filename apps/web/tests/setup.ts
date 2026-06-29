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

export interface DbState {
  users: Array<Record<string, unknown>>;
  counters: Array<Record<string, unknown>>;
  counterCheckIns: Array<Record<string, unknown>>;
}

export const state: DbState = {
  users: [],
  counters: [],
  counterCheckIns: [],
};

function reset() {
  state.users = [];
  state.counters = [];
  state.counterCheckIns = [];
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
    case 'users':
      return state.users;
    case 'counters':
      return state.counters;
    case 'counter_check_ins':
      return state.counterCheckIns;
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
    counters: { findFirst: async () => state.counters[0] ?? null },
    counterCheckIns: { findFirst: async () => state.counterCheckIns[0] ?? null },
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
        let persisted = false;
        const persist = () => {
          if (persisted) return;
          rowsFor(tableName).push(row);
          persisted = true;
        };
        return {
          returning: async () => {
            persist();
            return [row];
          },
          onConflictDoNothing: () => ({
            then: (
              onFulfilled?: (value: unknown) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => {
              persist();
              return Promise.resolve(undefined).then(onFulfilled, onRejected);
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
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: async () => [{}] }),
      }),
    }),
    delete: () => ({ where: () => ({ returning: async () => [{ id: 'x' }] }) }),
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

export function signInAs(userId: string) {
  (globalThis as { __testUserId?: string }).__testUserId = userId;
}
