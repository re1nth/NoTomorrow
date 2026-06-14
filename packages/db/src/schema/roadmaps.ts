import type { RoadmapGraphNode } from '@notomorrow/domain';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { goals } from './goals';

/**
 * `roadmaps` — LLM-generated plan for a Goal.
 *
 * arch/02-domain-model.md → Roadmap. The `graph` column stores the DAG of
 * milestone stubs as it streams in from the planner — typed via
 * `RoadmapGraphNode[]` from `@notomorrow/domain`. Persisted Milestone rows
 * still live in their own table; the graph is the raw planner output.
 */
export const roadmaps = pgTable(
  'roadmaps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    modelVersion: text('model_version').notNull(),
    graph: jsonb('graph').$type<RoadmapGraphNode[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (table) => ({
    byGoal: index('roadmaps_goal_idx').on(table.goalId),
  }),
);

export type RoadmapRow = typeof roadmaps.$inferSelect;
export type NewRoadmapRow = typeof roadmaps.$inferInsert;
