import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { rivalArchetypeValues } from './_enums';
import { users } from './users';

export const rivals = sqliteTable(
  'rivals',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    archetype: text('archetype', { enum: rivalArchetypeValues }).notNull(),
    domain: text('domain').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.archetype, table.domain] }),
  }),
);

export type RivalRow = typeof rivals.$inferSelect;
export type NewRivalRow = typeof rivals.$inferInsert;
