import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

// `name`, `email`, `emailVerified`, `image` are the columns the Auth.js
// Drizzle adapter reads and writes. They are nullable so the desktop
// runtime (which never opens a sign-in flow) simply leaves them null.
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    // Placeholder handle when the row is created by the Auth.js adapter
    // (which doesn't know about our column). The post-signin event
    // rewrites it to a nice slug of the email localpart.
    handle: text('handle').notNull().$defaultFn(() => `user_${randomUuid().slice(0, 12)}`),
    avatar: text('avatar'),
    // Safe default for adapter-created rows. Phase 3 adds a settings page
    // where the user can change it; Phase 3 also captures the browser
    // timezone at sign-in for a better first-run default.
    timezone: text('timezone').notNull().$defaultFn(() => 'UTC'),
    joinedAt: text('joined_at').notNull().$defaultFn(nowIso),
    name: text('name'),
    email: text('email'),
    emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
    image: text('image'),
  },
  (table) => ({
    handleUnique: uniqueIndex('users_handle_unique').on(table.handle),
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
