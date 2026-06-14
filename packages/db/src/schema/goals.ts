import { sql } from 'drizzle-orm';
import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { goalStatusEnum, horizonEnum } from './_enums';
import { users } from './users';

/**
 * `goals` — top-level user ambitions.
 *
 * arch/02-domain-model.md → Goal. `horizon` and `status` use Postgres enums
 * derived from `@notomorrow/domain`.
 */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    motivation: text('motivation').notNull().default(''),
    horizon: horizonEnum('horizon').notNull(),
    targetDate: date('target_date').notNull(),
    status: goalStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    byUser: index('goals_user_idx').on(table.userId),
    byStatus: index('goals_status_idx').on(table.status),
  }),
);

export type GoalRow = typeof goals.$inferSelect;
export type NewGoalRow = typeof goals.$inferInsert;
