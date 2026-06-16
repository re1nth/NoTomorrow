import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    handle: text('handle').notNull(),
    avatar: text('avatar'),
    timezone: text('timezone').notNull(),
    joinedAt: text('joined_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    handleUnique: uniqueIndex('users_handle_unique').on(table.handle),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
