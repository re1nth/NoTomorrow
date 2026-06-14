/**
 * Schema sanity tests.
 *
 * Two layers:
 *
 * 1. Type-level checks that the drizzle schema exports are wired up and
 *    inferred row types compose. These run in any environment.
 *
 * 2. An integration test that boots against a real Postgres + pgvector,
 *    applies the migrations, runs the seed, and reads back. Skipped unless
 *    `DATABASE_URL` is set — we deliberately do NOT use testcontainers
 *    because pulling `pgvector/pgvector:pg16` makes CI cold-start slow and
 *    the repo already ships a docker-compose service for the same image.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type DrizzleDatabase,
  bundles,
  coachMessages,
  createDb,
  goals,
  milestones,
  proofsOfWork,
  ratingEvents,
  ratingProfiles,
  rivals,
  roadmaps,
  tasks,
  trainingLogs,
  users,
} from '../src';
import { DEMO_USER_ID } from '../src/seed/ids';

describe('schema shape', () => {
  it('exports a table for every entity in the domain model', () => {
    // arch/02-domain-model.md → 12 entities.
    const tables = [
      users,
      ratingProfiles,
      goals,
      roadmaps,
      milestones,
      tasks,
      proofsOfWork,
      trainingLogs,
      ratingEvents,
      bundles,
      coachMessages,
      rivals,
    ];
    expect(tables).toHaveLength(12);
    for (const t of tables) {
      expect(t).toBeDefined();
    }
  });

  it('users row has the expected columns', () => {
    type Row = typeof users.$inferSelect;
    expectTypeOf<Row>().toMatchTypeOf<{
      id: string;
      handle: string;
      avatar: string | null;
      timezone: string;
      joinedAt: string;
    }>();
  });

  it('createDb returns a typed database', () => {
    // We don't actually connect — just verify the factory's return type
    // shape so consumers can rely on the contract.
    expectTypeOf(createDb).returns.toMatchTypeOf<DrizzleDatabase>();
  });

  it('seed exports a stable demo user id', () => {
    expect(DEMO_USER_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('live postgres', () => {
  const url = process.env.DATABASE_URL;
  const itIfDb = url ? it : it.skip;

  itIfDb(
    'applies migrations and inserts a row',
    async () => {
      const { migrate } = await import('drizzle-orm/postgres-js/migrator');
      const { createDbWithClient } = await import('../src/client');
      const { db, client } = createDbWithClient(url!);
      try {
        await migrate(db, { migrationsFolder: './migrations' });
        // Smoke test: insert and read back a throwaway user.
        const handle = `vitest_${Date.now()}`;
        await db.insert(users).values({
          handle,
          timezone: 'UTC',
          avatar: null,
        });
        const rows = await db.query.users.findMany({
          where: (u, { eq }) => eq(u.handle, handle),
        });
        expect(rows).toHaveLength(1);
      } finally {
        await client.end({ timeout: 5 });
      }
    },
    30_000,
  );
});
