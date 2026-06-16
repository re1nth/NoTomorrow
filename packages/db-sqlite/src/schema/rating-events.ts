import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { proofsOfWork } from './proofs';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const ratingEvents = sqliteTable(
  'rating_events',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    staminaDelta: integer('stamina_delta').notNull().default(0),
    expertiseDelta: integer('expertise_delta').notNull().default(0),
    reason: text('reason').notNull(),
    sourceProofId: text('source_proof_id').references(() => proofsOfWork.id, {
      onDelete: 'set null',
    }),
    occurredAt: text('occurred_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byUserDomain: index('rating_events_user_domain_idx').on(table.userId, table.domain),
    byOccurredAt: index('rating_events_occurred_at_idx').on(table.occurredAt),
  }),
);

export type RatingEventRow = typeof ratingEvents.$inferSelect;
export type NewRatingEventRow = typeof ratingEvents.$inferInsert;
