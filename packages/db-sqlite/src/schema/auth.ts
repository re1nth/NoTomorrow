/**
 * Legacy Auth.js adapter tables. Kept as no-op schema definitions so
 * databases created from migration 0005 still line up with the drizzle
 * client, but no code reads or writes them anymore — cloud mode now
 * uses email + password via the Credentials provider and JWT sessions
 * (see apps/web/lib/nextauth.ts). Nothing outside this file references
 * these exports; a future migration can drop the underlying tables.
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
