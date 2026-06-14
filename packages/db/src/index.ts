/**
 * @notomorrow/db — Drizzle schema + typed client factory for Postgres.
 *
 *   import { createDb } from '@notomorrow/db';
 *   import { users, goals, tasks } from '@notomorrow/db/schema';
 *
 * The DB is the persistence contract shared by `apps/web`, `apps/coach`
 * (which connects via asyncpg from Python), and `infra/inngest`.
 */
export { createDb, createDbWithClient, type DrizzleDatabase, type CreateDbOptions } from './client';
export * as schema from './schema/index';
export * from './schema/index';
export { DEMO_USER_ID } from './seed/ids';
