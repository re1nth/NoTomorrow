/**
 * @notomorrow/db — Drizzle schema + typed client factory for Postgres.
 *
 *   import { createDb } from '@notomorrow/db';
 *   import { users, counters } from '@notomorrow/db/schema';
 */
export { createDb, createDbWithClient, type DrizzleDatabase, type CreateDbOptions } from './client';
export * as schema from './schema/index';
export * from './schema/index';

export const DEMO_USER_ID = '00000000-0000-7000-8000-000000000001';
