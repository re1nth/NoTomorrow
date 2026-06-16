import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { punchTypeValues, taskStatusValues } from './_enums';
import { milestones } from './milestones';

const randomUuid = () => crypto.randomUUID();

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    milestoneId: text('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type', { enum: punchTypeValues }).notNull(),
    estMinutes: integer('est_minutes').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status', { enum: taskStatusValues }).notNull().default('pending'),
  },
  (table) => ({
    byMilestone: index('tasks_milestone_idx').on(table.milestoneId),
    byStatus: index('tasks_status_idx').on(table.status),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
