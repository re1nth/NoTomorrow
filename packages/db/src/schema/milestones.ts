import { date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { milestoneStatusEnum } from './_enums';
import { roadmaps } from './roadmaps';

/**
 * `milestones` — "Round". Major checkpoint inside a roadmap.
 *
 * arch/02-domain-model.md → Milestone. `order` is the user-facing sequence
 * inside the roadmap.
 */
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roadmapId: uuid('roadmap_id')
      .notNull()
      .references(() => roadmaps.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    deliverable: text('deliverable').notNull(),
    dueDate: date('due_date').notNull(),
    status: milestoneStatusEnum('status').notNull().default('locked'),
  },
  (table) => ({
    byRoadmap: index('milestones_roadmap_idx').on(table.roadmapId),
    byRoadmapOrder: index('milestones_roadmap_order_idx').on(table.roadmapId, table.order),
  }),
);

export type MilestoneRow = typeof milestones.$inferSelect;
export type NewMilestoneRow = typeof milestones.$inferInsert;
