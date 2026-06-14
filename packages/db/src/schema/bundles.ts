import { sql } from 'drizzle-orm';
import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { goals } from './goals';
import { users } from './users';

/**
 * pgvector custom column. Drizzle ships a `vector` helper in newer versions,
 * but a hand-rolled `customType` keeps us decoupled from drizzle-orm's exact
 * minor version and explicit about the dimensionality. 1536 matches
 * text-embedding-3-small; bump if the embedder changes.
 */
const VECTOR_DIM = 1536;

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${VECTOR_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(Number);
  },
});

/**
 * `bundles` — reusable goal templates. Forks become new Goals.
 *
 * arch/02-domain-model.md → Bundle. `embedding` is the pgvector column used
 * for semantic search; the HNSW index is created in
 * `migrations/0000_pgvector_setup.sql` so it runs against the right column.
 *
 * Note: the HNSW index itself is added in a follow-up SQL migration after
 * `drizzle-kit generate` produces the base table — drizzle-kit does not yet
 * emit `USING hnsw (... vector_cosine_ops)` natively.
 */
export const bundles = pgTable(
  'bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceGoalId: uuid('source_goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    stars: integer('stars').notNull().default(0),
    forks: integer('forks').notNull().default(0),
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    byAuthor: index('bundles_author_idx').on(table.authorId),
  }),
);

export type BundleRow = typeof bundles.$inferSelect;
export type NewBundleRow = typeof bundles.$inferInsert;
export { VECTOR_DIM };
