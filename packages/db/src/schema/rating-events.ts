import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proofsOfWork } from './proofs';
import { users } from './users';

/**
 * `rating_events` — atomic change to a RatingProfile.
 *
 * arch/02-domain-model.md → RatingEvent.
 * arch/03-rating-system.md → "No silent updates" — every rating move writes
 * one row so the fight-history view can render *why* a rating moved.
 *
 * `delta` is split into two integer columns (stamina, expertise) rather than
 * a jsonb blob so we can aggregate with plain SQL.
 */
export const ratingEvents = pgTable(
  'rating_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    staminaDelta: integer('stamina_delta').notNull().default(0),
    expertiseDelta: integer('expertise_delta').notNull().default(0),
    reason: text('reason').notNull(),
    sourceProofId: uuid('source_proof_id').references(() => proofsOfWork.id, {
      onDelete: 'set null',
    }),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    byUserDomain: index('rating_events_user_domain_idx').on(table.userId, table.domain),
    byOccurredAt: index('rating_events_occurred_at_idx').on(table.occurredAt),
  }),
);

export type RatingEventRow = typeof ratingEvents.$inferSelect;
export type NewRatingEventRow = typeof ratingEvents.$inferInsert;
