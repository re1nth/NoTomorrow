import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const nowIso = () => new Date().toISOString();

export const ratingProfiles = sqliteTable(
  'rating_profiles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    stamina: integer('stamina').notNull().default(1200),
    expertise: integer('expertise').notNull().default(1200),
    lastUpdated: text('last_updated').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.domain] }),
  }),
);

export type RatingProfileRow = typeof ratingProfiles.$inferSelect;
export type NewRatingProfileRow = typeof ratingProfiles.$inferInsert;
