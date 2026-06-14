import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { channelEnum, coachToneEnum } from './_enums';
import { tasks } from './tasks';
import { users } from './users';

/**
 * `coach_messages` — persona communication from coach to user.
 *
 * arch/02-domain-model.md → CoachMessage. `ctaTaskId` is optional — clicking
 * routes to that Task in the UI.
 */
export const coachMessages = pgTable(
  'coach_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    tone: coachToneEnum('tone').notNull(),
    body: text('body').notNull(),
    ctaTaskId: uuid('cta_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    byUser: index('coach_messages_user_idx').on(table.userId),
    bySentAt: index('coach_messages_sent_at_idx').on(table.sentAt),
  }),
);

export type CoachMessageRow = typeof coachMessages.$inferSelect;
export type NewCoachMessageRow = typeof coachMessages.$inferInsert;
