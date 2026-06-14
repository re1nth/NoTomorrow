import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { rivalArchetypeEnum } from './_enums';
import { users } from './users';

/**
 * `rivals` — opponents on a user's leaderboard.
 *
 * arch/02-domain-model.md → Rival. A user can have at most one rival of each
 * (archetype, domain) pairing — composite PK encodes that.
 */
export const rivals = pgTable(
  'rivals',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    archetype: rivalArchetypeEnum('archetype').notNull(),
    domain: text('domain').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.archetype, table.domain] }),
  }),
);

export type RivalRow = typeof rivals.$inferSelect;
export type NewRivalRow = typeof rivals.$inferInsert;
