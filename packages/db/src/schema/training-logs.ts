import {
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * `training_logs` — daily check-in.
 *
 * arch/02-domain-model.md → TrainingLog. One row per (user, date) — enforced
 * with a unique index.
 */
export const trainingLogs = pgTable(
  'training_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    mood: integer('mood').notNull(),
    hoursTrained: doublePrecision('hours_trained').notNull().default(0),
    blockers: text('blockers').notNull().default(''),
    coachReply: text('coach_reply'),
  },
  (table) => ({
    byUserDate: uniqueIndex('training_logs_user_date_unique').on(table.userId, table.date),
  }),
);

export type TrainingLogRow = typeof trainingLogs.$inferSelect;
export type NewTrainingLogRow = typeof trainingLogs.$inferInsert;
