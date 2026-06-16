import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

/**
 * `counters` — once-a-day check-in streaks across user-defined threads
 * (gym, badminton, builder, etc). `last_check_in` is the local-tz date the
 * user last incremented; the route guards against a second bump on the
 * same day. Unique (user, name) so a thread can't be created twice.
 */
export const counters = sqliteTable(
  'counters',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    count: integer('count').notNull().default(0),
    // YYYY-MM-DD in the user's timezone, or null until first check-in.
    lastCheckIn: text('last_check_in'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byUser: index('counters_user_idx').on(table.userId),
    uniqueName: uniqueIndex('counters_user_name_unique').on(table.userId, table.name),
  }),
);

export type CounterRow = typeof counters.$inferSelect;
export type NewCounterRow = typeof counters.$inferInsert;
