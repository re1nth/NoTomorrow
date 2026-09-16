import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const friendships = sqliteTable(
  'friendships',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: text('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'blocked'] })
      .notNull()
      .default('pending'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    byRequester: index('friendships_requester_idx').on(table.requesterId),
    byAddressee: index('friendships_addressee_idx').on(table.addresseeId),
    uniquePair: uniqueIndex('friendships_pair_unique').on(table.requesterId, table.addresseeId),
  }),
);

export const directMessages = sqliteTable(
  'direct_messages',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => ({
    bySender: index('direct_messages_sender_idx').on(table.senderId),
    byRecipient: index('direct_messages_recipient_idx').on(table.recipientId),
    byThread: index('direct_messages_thread_idx').on(table.senderId, table.recipientId, table.createdAt),
  }),
);

export type FriendshipRow = typeof friendships.$inferSelect;
export type NewFriendshipRow = typeof friendships.$inferInsert;
export type DirectMessageRow = typeof directMessages.$inferSelect;
export type NewDirectMessageRow = typeof directMessages.$inferInsert;
