import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

/**
 * `email_verification_codes` — one row per outstanding verification.
 * The 6-digit code sent to the user is bcrypt-hashed before storage so
 * a DB leak doesn't hand out valid codes. `attempts` caps brute force;
 * `expires_at` is a unix-ms timestamp.
 */
export const emailVerificationCodes = sqliteTable(
  'email_verification_codes',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byUser: index('email_verification_codes_user_idx').on(table.userId),
  }),
);

/**
 * `password_reset_tokens` — one row per issued reset link. Token stored
 * as bcrypt hash; `used_at` marks single-use consumption.
 */
export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byUser: index('password_reset_tokens_user_idx').on(table.userId),
    tokenHashUnique: uniqueIndex('password_reset_tokens_token_hash_unique').on(table.tokenHash),
  }),
);

export type EmailVerificationCodeRow = typeof emailVerificationCodes.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
