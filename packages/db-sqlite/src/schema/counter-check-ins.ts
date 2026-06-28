import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { counters } from './counters';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

/**
 * `counter_check_ins` — append-only log of every day a counter was bumped,
 * so we can render a GitHub-style contribution heatmap. `day` is the
 * YYYY-MM-DD string in the user's timezone (same shape `counters.last_check_in`
 * uses), and the unique (counter_id, day) index enforces the "once per day"
 * invariant at the storage layer too.
 */
export const counterCheckIns = sqliteTable(
  'counter_check_ins',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    counterId: text('counter_id')
      .notNull()
      .references(() => counters.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byCounter: index('counter_check_ins_counter_idx').on(table.counterId),
    byUser: index('counter_check_ins_user_idx').on(table.userId),
    uniqueDay: uniqueIndex('counter_check_ins_counter_day_unique').on(table.counterId, table.day),
  }),
);

export type CounterCheckInRow = typeof counterCheckIns.$inferSelect;
export type NewCounterCheckInRow = typeof counterCheckIns.$inferInsert;
