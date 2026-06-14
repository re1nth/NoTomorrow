import { sql } from 'drizzle-orm';
import { integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * `rating_profiles` — per-domain Elo.
 *
 * arch/02-domain-model.md → RatingProfile.
 * Composite PK on (userId, domain) — one row per user per domain.
 */
export const ratingProfiles = pgTable(
  'rating_profiles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    stamina: integer('stamina').notNull().default(1200),
    expertise: integer('expertise').notNull().default(1200),
    lastUpdated: timestamp('last_updated', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.domain] }),
  }),
);

export type RatingProfileRow = typeof ratingProfiles.$inferSelect;
export type NewRatingProfileRow = typeof ratingProfiles.$inferInsert;
