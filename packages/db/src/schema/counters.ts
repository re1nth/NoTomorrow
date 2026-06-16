import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * `counters` — once-a-day check-in streaks across user-defined threads
 * (gym, badminton, builder, etc). Mirrors the SQLite schema so route
 * handlers that import from `@notomorrow/db` typecheck in both runtimes.
 * Web runs the postgres flavor; desktop's webpack alias swaps in the
 * SQLite tables at build time.
 */
export const counters = pgTable(
  'counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    count: integer('count').notNull().default(0),
    lastCheckIn: date('last_check_in'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byUser: index('counters_user_idx').on(table.userId),
    uniqueName: uniqueIndex('counters_user_name_unique').on(table.userId, table.name),
  }),
);

export type CounterRow = typeof counters.$inferSelect;
export type NewCounterRow = typeof counters.$inferInsert;
