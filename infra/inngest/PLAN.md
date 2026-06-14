# infra/inngest — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 1.** Depends on `domain` stub; calls `apps/coach` at runtime.

## Mission

Background job definitions: daily check-ins, weekly recalibration, streak
decay, on-demand proof verification. Functions are TS modules registered with
the Inngest dev server (and Inngest cloud in prod). `apps/web` imports them at
boot.

## Scope

**In:**
- `daily-coach` — per-user cron at 07:00 local, calls Coach Service
- `weekly-recalibrate` — Sunday 20:00 local, calls Coach Service
- `streak-decay` — hourly tick, updates `RatingProfile.stamina`
- `verify-proof` — on-demand, triggered by `apps/web` when proof submitted
- Typed event payloads (Zod) shared with `apps/web`

**Out:**
- Cron policy decisions (already settled in [arch/06-coach-loop.md](../../arch/06-coach-loop.md))
- DB writes outside what each loop legitimately produces (RatingEvent,
  CoachMessage, Roadmap version)

## Dependencies (consumes)

- `@notomorrow/domain` — event payload schemas
- `@notomorrow/db` — direct DB writes for streak decay
- `apps/coach` — HTTP calls for LLM-bound work
- `inngest` package (TS SDK)

## Exposes

- Function exports: `import { dailyCoach, weeklyRecalibrate, ... } from '@notomorrow/inngest'`
- Event types: `import type { ProofSubmittedEvent, ... } from '@notomorrow/inngest/events'`

The web app mounts them at `/api/inngest`.

## Build steps (ordered)

1. `package.json` with deps: `inngest`, `@notomorrow/domain`, `@notomorrow/db`
2. `events.ts` — Zod schemas for every event payload
3. `client.ts` — Inngest client factory
4. `functions/daily-coach.ts` — first function as the pattern (per-user cron,
   fan-out by user list query)
5. `functions/weekly-recalibrate.ts`
6. `functions/streak-decay.ts` — direct DB write, no LLM call
7. `functions/verify-proof.ts` — calls Coach Service, writes RatingEvent on
   pass
8. `index.ts` — barrel export
9. Smoke tests using Inngest's test utilities

## Acceptance criteria

- [ ] All four functions registered with local Inngest dev server
- [ ] Per-user cron fan-out (timezone-aware) verified with a multi-user seed
- [ ] `verify-proof` returns a `CoachMessage` on fail without crashing
- [ ] Retry policy set on `verify-proof` (Coach Service may be slow / cold)
- [ ] Smoke tests assert event → function dispatch

## Verification

```
docker compose up -d
inngest dev
pnpm --filter @notomorrow/inngest test
# in apps/web: trigger a proof submission, watch the Inngest dashboard
```

## Deferred / out of scope

- Fan-out optimization (assume seed scale for MVP)
- Dead-letter queue tooling beyond Inngest defaults

## Open questions

- Where do per-user crons get materialized — query users at trigger time and
  fan out, or pre-register one Inngest function per timezone? Recommendation:
  query + fan out for now; revisit when user count is non-trivial.

## Coordination

- Coach Service HTTP contract is shared; if a Coach endpoint changes, the
  inngest function calling it must change in lockstep.
- Streak decay writes directly to DB — coordinate with `packages/db` owner on
  the exact column / index needed.

## Handoff notes

_None yet._
