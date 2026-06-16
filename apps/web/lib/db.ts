/**
 * Process-wide Drizzle client.
 *
 * Default runtime is `web` (Postgres). When `NOTOMORROW_RUNTIME=desktop` is
 * set by the Electron main process, we build a SQLite-backed client.
 *
 * We deliberately do NOT statically `import` either driver. Static imports of
 * `better-sqlite3`/`bindings` get pulled into webpack's RSC bundle (via the
 * transpiled `@notomorrow/db-sqlite` workspace package), and `bindings`'
 * stack-frame walker blows up inside webpack with a misleading
 * `Cannot read properties of undefined (reading 'indexOf')`. Loading both
 * drivers via `createRequire` keeps them as runtime Node requires —
 * `serverExternalPackages` does the rest.
 *
 * The proxy keeps construction lazy so `next build`'s collect-page-data pass
 * never connects.
 */
// DrizzleDatabase is a structural type — both drivers' DBs satisfy enough of
// it that the route handlers (db.query.*, db.select(), db.insert()) work
// against either. We re-export the Postgres type as the canonical one and
// runtime-cast the sqlite instance to it.
import type { DrizzleDatabase } from '@notomorrow/db';
// Schemas only — no native deps. Webpack compiles via transpilePackages and
// the resulting JS object is the SAME instance route handlers see through
// their aliased `@notomorrow/db` imports, so `db.query.users.findFirst` and
// `eq(users.id, ...)` agree on the same table metadata.
import * as sqliteSchema from '@notomorrow/db-sqlite/schema';

declare global {
  // eslint-disable-next-line no-var
  var __notomorrowDb: DrizzleDatabase | undefined;
  // Webpack's documented escape hatch — compiles to the real Node `require`
  // at build time, bypassing both bundling and the `webpackEmptyContext`
  // dynamic-require shim. We use it for native modules (better-sqlite3) and
  // workspace packages we don't want webpack to follow.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function __non_webpack_require__<T = unknown>(mod: string): T;
}

function buildDesktop(): DrizzleDatabase {
  const filePath = process.env.SQLITE_DB_PATH;
  if (!filePath) {
    throw new Error('SQLITE_DB_PATH must be set when NOTOMORROW_RUNTIME=desktop');
  }
  const Database = __non_webpack_require__<
    new (path: string) => { pragma(s: string): unknown }
  >('better-sqlite3');
  const { drizzle } = __non_webpack_require__<{
    drizzle: (db: unknown, opts: { schema: unknown }) => DrizzleDatabase;
  }>('drizzle-orm/better-sqlite3');
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema: sqliteSchema });
}

function buildWeb(): DrizzleDatabase {
  // env is read lazily — only validated when we actually go down the web path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { env } = require('./env') as { env: { DATABASE_URL: string } };
  const { createDb } = __non_webpack_require__<{
    createDb: (url: string, opts: { max: number }) => DrizzleDatabase;
  }>('@notomorrow/db');
  return createDb(env.DATABASE_URL, { max: 5 });
}

function build(): DrizzleDatabase {
  if (global.__notomorrowDb) return global.__notomorrowDb;
  const created = process.env.NOTOMORROW_RUNTIME === 'desktop' ? buildDesktop() : buildWeb();
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
