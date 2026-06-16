import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { milestoneStatusValues } from './_enums';
import { roadmaps } from './roadmaps';

const randomUuid = () => crypto.randomUUID();

export const milestones = sqliteTable(
  'milestones',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    roadmapId: text('roadmap_id')
      .notNull()
      .references(() => roadmaps.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    deliverable: text('deliverable').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status', { enum: milestoneStatusValues }).notNull().default('locked'),
  },
  (table) => ({
    byRoadmap: index('milestones_roadmap_idx').on(table.roadmapId),
    byRoadmapOrder: index('milestones_roadmap_order_idx').on(table.roadmapId, table.order),
  }),
);

export type MilestoneRow = typeof milestones.$inferSelect;
export type NewMilestoneRow = typeof milestones.$inferInsert;
