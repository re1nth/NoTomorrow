import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { channelValues, coachToneValues } from './_enums';
import { tasks } from './tasks';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const coachMessages = sqliteTable(
  'coach_messages',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: channelValues }).notNull(),
    tone: text('tone', { enum: coachToneValues }).notNull(),
    body: text('body').notNull(),
    ctaTaskId: text('cta_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    sentAt: text('sent_at').notNull().$defaultFn(nowIso),
    readAt: text('read_at'),
  },
  (table) => ({
    byUser: index('coach_messages_user_idx').on(table.userId),
    bySentAt: index('coach_messages_sent_at_idx').on(table.sentAt),
  }),
);

export type CoachMessageRow = typeof coachMessages.$inferSelect;
export type NewCoachMessageRow = typeof coachMessages.$inferInsert;
