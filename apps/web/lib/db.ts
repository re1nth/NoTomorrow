/**
 * Process-wide Drizzle client.
 *
 * Constructing the pool eagerly would connect at module load and break the
 * Next `phase-production-build` collect-page-data pass (no DB available).
 * Instead we expose a lazy proxy that creates the client on first method
 * call. The instance is cached on `globalThis` so dev-mode hot reloads
 * don't leak connections.
 */
import { createDb, type DrizzleDatabase } from '@notomorrow/db';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __notomorrowDb: DrizzleDatabase | undefined;
}

function build(): DrizzleDatabase {
  if (global.__notomorrowDb) return global.__notomorrowDb;
  const created = createDb(env.DATABASE_URL, { max: 5 });
  if (process.env.NODE_ENV !== 'production') {
    global.__notomorrowDb = created;
  }
  return created;
}

let instance: DrizzleDatabase | null = null;
function get(): DrizzleDatabase {
  if (!instance) instance = build();
  return instance;
}

export const db: DrizzleDatabase = new Proxy({} as DrizzleDatabase, {
  get(_t, key: string | symbol) {
    return (get() as unknown as Record<string | symbol, unknown>)[key];
  },
}) as DrizzleDatabase;
