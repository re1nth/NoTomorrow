import { date, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { counters } from './counters';
import { users } from './users';

/**
 * `counter_check_ins` — append-only log of every day a counter was bumped,
 * so we can render a GitHub-style contribution heatmap. Mirrors the SQLite
 * shape; the unique (counter_id, day) index doubles as the storage-level
 * guard for the "once per day" rule already enforced at the API layer.
 */
export const counterCheckIns = pgTable(
  'counter_check_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    counterId: uuid('counter_id')
      .notNull()
      .references(() => counters.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byCounter: index('counter_check_ins_counter_idx').on(table.counterId),
    byUser: index('counter_check_ins_user_idx').on(table.userId),
    uniqueDay: uniqueIndex('counter_check_ins_counter_day_unique').on(table.counterId, table.day),
  }),
);

export type CounterCheckInRow = typeof counterCheckIns.$inferSelect;
export type NewCounterCheckInRow = typeof counterCheckIns.$inferInsert;
