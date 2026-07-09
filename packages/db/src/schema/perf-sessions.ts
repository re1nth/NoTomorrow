import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * `perf_sessions` — one row per completed Performance Checker session.
 * Mirrors the SQLite schema so route handlers that import from
 * `@notomorrow/db` typecheck in both runtimes. Web runs the postgres
 * flavor; desktop's webpack alias swaps in the SQLite tables at build
 * time. The tree the user built lives in `tree_json`; summary stats
 * live on the row so the heatmap doesn't have to walk the JSON.
 */
export const perfSessions = pgTable(
  'perf_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    testSlug: text('test_slug').notNull(),
    topic: text('topic').notNull(),
    day: text('day').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    totalNodes: integer('total_nodes').notNull(),
    maxDepth: integer('max_depth').notNull(),
    maxBranching: integer('max_branching').notNull(),
    score: integer('score').notNull(),
    treeJson: text('tree_json').notNull(),
  },
  (table) => ({
    byUser: index('perf_sessions_user_idx').on(table.userId),
    byUserTestDay: index('perf_sessions_user_test_day_idx').on(
      table.userId,
      table.testSlug,
      table.day,
    ),
  }),
);

export type PerfSessionRow = typeof perfSessions.$inferSelect;
export type NewPerfSessionRow = typeof perfSessions.$inferInsert;
