import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * `users` — account + identity. Timezone is stored on the row for per-user
 * date bucketing.
 *
 * Note on PK: ideally uuid v7 (sortable). Postgres 16 does not ship a native
 * `uuidv7()`, and we don't want a pgcrypto dependency for this. We default to
 * `gen_random_uuid()` (uuid v4) — application code may pass a v7 id explicitly
 * when desired. Revisit when Postgres 18 lands `uuidv7()`.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    handle: text('handle').notNull(),
    avatar: text('avatar'),
    timezone: text('timezone').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    handleUnique: uniqueIndex('users_handle_unique').on(table.handle),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
