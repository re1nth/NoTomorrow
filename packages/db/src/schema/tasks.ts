import { date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { punchTypeEnum, taskStatusEnum } from './_enums';
import { milestones } from './milestones';

/**
 * `tasks` — "Punch". Atomic action under a Milestone.
 *
 * arch/02-domain-model.md → Task. `type` is the punch taxonomy enum.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milestoneId: uuid('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: punchTypeEnum('type').notNull(),
    estMinutes: integer('est_minutes').notNull(),
    dueDate: date('due_date').notNull(),
    status: taskStatusEnum('status').notNull().default('pending'),
  },
  (table) => ({
    byMilestone: index('tasks_milestone_idx').on(table.milestoneId),
    byStatus: index('tasks_status_idx').on(table.status),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
