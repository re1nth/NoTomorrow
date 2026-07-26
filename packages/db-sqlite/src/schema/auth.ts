/**
 * Auth.js (@auth/drizzle-adapter) tables.
 *
 * Field names on the Drizzle objects must match what the adapter reads
 * (userId, providerAccountId, sessionToken, ...). SQL column names can
 * differ, so we keep repo-wide snake_case at the database layer.
 *
 * The desktop runtime never populates these tables — they only fill up
 * once NOTOMORROW_AUTH=cloud and users start signing in with Google.
 */
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const accounts = sqliteTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  }),
);

export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export type AccountRow = typeof accounts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type VerificationTokenRow = typeof verificationTokens.$inferSelect;
