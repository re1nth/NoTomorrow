import type { ProofPayload } from '@notomorrow/domain';
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proofKindEnum } from './_enums';
import { tasks } from './tasks';

/**
 * `proofs_of_work` — evidence attached to a Task.
 *
 * arch/02-domain-model.md → ProofOfWork. `payload` is the discriminated
 * union from `@notomorrow/domain` (repo / url / video / writeup). `score` is
 * the 1..5 LLM grade, null until graded by the coach service.
 */
export const proofsOfWork = pgTable(
  'proofs_of_work',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    kind: proofKindEnum('kind').notNull(),
    payload: jsonb('payload').$type<ProofPayload>().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
    score: integer('score'),
  },
  (table) => ({
    byTask: index('proofs_task_idx').on(table.taskId),
  }),
);

export type ProofOfWorkRow = typeof proofsOfWork.$inferSelect;
export type NewProofOfWorkRow = typeof proofsOfWork.$inferInsert;
