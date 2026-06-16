import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const randomUuid = () => crypto.randomUUID();

export const trainingLogs = sqliteTable(
  'training_logs',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    mood: integer('mood').notNull(),
    hoursTrained: real('hours_trained').notNull().default(0),
    blockers: text('blockers').notNull().default(''),
    coachReply: text('coach_reply'),
  },
  (table) => ({
    byUserDate: uniqueIndex('training_logs_user_date_unique').on(table.userId, table.date),
  }),
);

export type TrainingLogRow = typeof trainingLogs.$inferSelect;
export type NewTrainingLogRow = typeof trainingLogs.$inferInsert;
