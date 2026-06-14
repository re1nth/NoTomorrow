/**
 * Schema barrel — re-exports every drizzle table so consumers can do:
 *
 *   import { users, goals, tasks } from '@notomorrow/db/schema';
 *
 * Postgres enums are exported too (consumers occasionally need the enum
 * value tuple, e.g. for form rendering).
 */
export * from './_enums';
export * from './users';
export * from './rating-profiles';
export * from './goals';
export * from './roadmaps';
export * from './milestones';
export * from './tasks';
export * from './proofs';
export * from './training-logs';
export * from './rating-events';
export * from './bundles';
export * from './coach-messages';
export * from './rivals';
