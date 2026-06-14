# packages/db — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 1.** Depends on `packages/domain` interface stubs.

## Mission

Drizzle schema + migrations + typed client factory for Postgres. The persistence
layer used by `apps/web`, `apps/coach`, and `infra/inngest`.

## Scope

**In:**
- Drizzle schema files mirroring entities in [arch/02-domain-model.md](../../arch/02-domain-model.md)
- Migration tooling (`drizzle-kit`)
- Connection / client factory: `createDb(url)`
- pgvector column for `Bundle.embedding`
- Seed scripts for local dev fixtures

**Out:**
- Query patterns / repository layer (queries live in consumer apps)
- Caching policy (Redis usage lives in `apps/web`)
- Database hosting decisions (Neon vs Supabase — owned at deploy time)

## Dependencies (consumes)

- `@notomorrow/domain` — enum values, so DB columns match Zod enums
- Postgres 15+ with `pgvector` extension

## Exposes

- `import { createDb } from '@notomorrow/db'`
- `import { goals, tasks, ... } from '@notomorrow/db/schema'`
- CLI: `pnpm --filter @notomorrow/db migrate`, `pnpm --filter @notomorrow/db seed`

## Build steps (ordered)

1. `package.json` with deps: `drizzle-orm`, `drizzle-kit`, `postgres`,
   `@notomorrow/domain`
2. `drizzle.config.ts` pointing at local Postgres
3. `schema/users.ts` — first entity end-to-end as the pattern
4. Remaining schema files: `rating-profiles`, `goals`, `roadmaps`, `milestones`,
   `tasks`, `proofs`, `training-logs`, `rating-events`, `bundles`,
   `coach-messages`, `rivals`
5. Generate initial migration: `drizzle-kit generate`
6. `client.ts` — `createDb(url)` factory with pool config
7. `seed/index.ts` — insert one full demo user (goal → roadmap → milestones →
   tasks → one verified proof → rating events)
8. CLI scripts in `package.json`: `migrate`, `migrate:gen`, `seed`, `reset`

## Acceptance criteria

- [ ] All entities have schema files with foreign keys + indexes
- [ ] Enum columns reference enums from `@notomorrow/domain` (no string drift)
- [ ] `pnpm migrate` applies cleanly to a fresh Postgres
- [ ] `pnpm seed` succeeds and produces a fully linked demo dataset
- [ ] `createDb()` returns a typed client; sample query passes typecheck
- [ ] pgvector column on `Bundle.embedding` with HNSW index

## Verification

```
docker compose up -d postgres
pnpm --filter @notomorrow/db migrate
pnpm --filter @notomorrow/db seed
psql $DATABASE_URL -c '\dt'
```

## Deferred / out of scope

- Read replicas / sharding
- Audit logging columns (revisit when there are real users)
- Soft deletes (everything hard-deletes for now; bundles add a flag later)

## Open questions

- Use `uuid` or `nanoid` for primary keys? Recommendation: `uuid v7` (sortable,
  collision-safe, native pg support).
- Timestamps in UTC + user timezone separately, or use `timestamptz` only?
  Recommendation: `timestamptz` everywhere, user timezone on `users` row.

## Coordination

- Coach Service reads via async Postgres driver (asyncpg) — schema is the
  contract; no shared TS client.
- Any column rename or type narrowing is a breaking interface change.
