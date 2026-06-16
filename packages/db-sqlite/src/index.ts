/**
 * Package root — re-exports schema + small compat shims only.
 *
 * The runtime SQLite client and the migration runner live behind dedicated
 * subpath exports (`@notomorrow/db-sqlite/client`, `/migrate`). They are not
 * re-exported here because consumers that pull the root barrel through a
 * webpack alias (apps/web in desktop mode) would otherwise drag
 * `better-sqlite3` + `bindings` into the bundle, and `bindings`' stack-frame
 * walker blows up there.
 */
export * as schema from './schema/index';
export * from './schema/index';

// Compat shims so a webpack alias of `@notomorrow/db` → this package satisfies
// imports written against the Postgres package.
export type { SqliteDatabase as DrizzleDatabase } from './client';
export const DEMO_USER_ID = '00000000-0000-7000-8000-000000000001';
