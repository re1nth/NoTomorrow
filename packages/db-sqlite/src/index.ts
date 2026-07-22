/**
 * Package root — re-exports schema plus the DB type alias and the seed
 * user id.
 *
 * The runtime SQLite client and the migration runner live behind dedicated
 * subpath exports (`@notomorrow/db-sqlite/client`, `/migrate`). They are
 * not re-exported here because consumers that pull the root barrel would
 * otherwise drag `better-sqlite3` + `bindings` into the bundle, and
 * `bindings`' stack-frame walker blows up inside webpack.
 */
export * as schema from './schema/index';
export * from './schema/index';

export type { SqliteDatabase as DrizzleDatabase } from './client';
export const DEMO_USER_ID = '00000000-0000-7000-8000-000000000001';
