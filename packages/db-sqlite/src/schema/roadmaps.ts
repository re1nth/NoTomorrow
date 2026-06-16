import type { RoadmapGraphNode } from '@notomorrow/domain';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { goals } from './goals';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const roadmaps = sqliteTable(
  'roadmaps',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    generatedAt: text('generated_at').notNull().$defaultFn(nowIso),
    modelVersion: text('model_version').notNull(),
    graph: text('graph', { mode: 'json' }).$type<RoadmapGraphNode[]>().notNull().default([]),
  },
  (table) => ({
    byGoal: index('roadmaps_goal_idx').on(table.goalId),
  }),
);

export type RoadmapRow = typeof roadmaps.$inferSelect;
export type NewRoadmapRow = typeof roadmaps.$inferInsert;
