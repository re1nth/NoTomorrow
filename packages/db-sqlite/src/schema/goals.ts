import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { goalStatusValues, horizonValues } from './_enums';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    motivation: text('motivation').notNull().default(''),
    horizon: text('horizon', { enum: horizonValues }).notNull(),
    targetDate: text('target_date').notNull(),
    status: text('status', { enum: goalStatusValues }).notNull().default('draft'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byUser: index('goals_user_idx').on(table.userId),
    byStatus: index('goals_status_idx').on(table.status),
  }),
);

export type GoalRow = typeof goals.$inferSelect;
export type NewGoalRow = typeof goals.$inferInsert;
