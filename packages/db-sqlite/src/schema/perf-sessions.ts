import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

/**
 * `perf_sessions` — one row per completed Performance Checker session.
 * The tree the user built during the session lives in `tree_json`; we keep
 * summary stats (nodes, depth, branching, score) denormalised on the row
 * so the tracker heatmap can render without walking the JSON. `day` is
 * YYYY-MM-DD in the user's timezone, so the "max score per day" rollup is
 * a simple GROUP BY.
 */
export const perfSessions = sqliteTable(
  'perf_sessions',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    testSlug: text('test_slug').notNull(),
    topic: text('topic').notNull(),
    day: text('day').notNull(),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at').notNull().$defaultFn(nowIso),
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
