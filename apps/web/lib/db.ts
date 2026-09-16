/**
 * Process-wide Drizzle client, backed by SQLite via better-sqlite3.
 *
 * We deliberately do NOT statically `import` better-sqlite3. Static imports
 * get pulled into webpack's RSC bundle (via the transpiled
 * `@notomorrow/db-sqlite` workspace package), and `bindings`' stack-frame
 * walker blows up inside webpack with a misleading
 * `Cannot read properties of undefined (reading 'indexOf')`. Loading the
 * driver via `__non_webpack_require__` keeps it as a runtime Node require —
 * `serverExternalPackages` does the rest.
 *
 * The proxy keeps construction lazy so `next build`'s collect-page-data pass
 * never opens the SQLite file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DrizzleDatabase } from '@notomorrow/db-sqlite';
import { sqliteDbPath } from './db-config';
// Schemas only — no native deps. Webpack compiles via transpilePackages and
// the resulting JS object is the SAME instance route handlers see through
// their `@notomorrow/db-sqlite` imports, so `db.query.users.findFirst` and
// `eq(users.id, ...)` agree on the same table metadata.
import * as schema from '@notomorrow/db-sqlite/schema';

declare global {
  // eslint-disable-next-line no-var
  var __notomorrowDb: DrizzleDatabase | undefined;
  // Webpack's documented escape hatch — compiles to the real Node `require`
  // at build time, bypassing both bundling and the `webpackEmptyContext`
  // dynamic-require shim. We use it for native modules (better-sqlite3).
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function __non_webpack_require__<T = unknown>(mod: string): T;
}

function migrationsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'db-sqlite', 'migrations'),
    path.resolve(process.cwd(), 'packages', 'db-sqlite', 'migrations'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Could not locate db-sqlite migrations from ${process.cwd()}`);
  }
  return found;
}

function build(): DrizzleDatabase {
  if (global.__notomorrowDb) return global.__notomorrowDb;
  const filePath = sqliteDbPath();
  const Database = __non_webpack_require__<
    new (path: string) => { pragma(s: string): unknown }
  >('better-sqlite3');
  const { drizzle } = __non_webpack_require__<{
    drizzle: (db: unknown, opts: { schema: unknown }) => DrizzleDatabase;
  }>('drizzle-orm/better-sqlite3');
  const { migrate } = __non_webpack_require__<{
    migrate: (db: unknown, opts: { migrationsFolder: string }) => void;
  }>('drizzle-orm/better-sqlite3/migrator');
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  if (process.env.NODE_ENV !== 'production') {
    migrate(drizzle(sqlite, { schema }), { migrationsFolder: migrationsDir() });
  }
  const created = drizzle(sqlite, { schema });
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
  // Drizzle's `is()` walks the prototype chain to detect the SQLite
  // dialect. Forward getPrototypeOf so consumers that rely on that check
  // see the real drizzle client.
  getPrototypeOf() {
    return Object.getPrototypeOf(get());
  },
}) as DrizzleDatabase;
