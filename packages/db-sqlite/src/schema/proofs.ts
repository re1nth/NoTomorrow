import type { ProofPayload } from '@notomorrow/domain';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { proofKindValues } from './_enums';
import { tasks } from './tasks';

const nowIso = () => new Date().toISOString();
const randomUuid = () => crypto.randomUUID();

export const proofsOfWork = sqliteTable(
  'proofs_of_work',
  {
    id: text('id').primaryKey().$defaultFn(randomUuid),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: proofKindValues }).notNull(),
    payload: text('payload', { mode: 'json' }).$type<ProofPayload>().notNull(),
    submittedAt: text('submitted_at').notNull().$defaultFn(nowIso),
    verifiedAt: text('verified_at'),
    score: integer('score'),
  },
  (table) => ({
    byTask: index('proofs_task_idx').on(table.taskId),
  }),
);

export type ProofOfWorkRow = typeof proofsOfWork.$inferSelect;
export type NewProofOfWorkRow = typeof proofsOfWork.$inferInsert;
