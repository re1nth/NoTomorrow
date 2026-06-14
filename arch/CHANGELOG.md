# Architecture Changelog

Append a dated entry every time the architecture shifts. Newest at the top.

Format:
```
## YYYY-MM-DD — short headline
- What changed
- Why
- Which docs were touched
```

---

## 2026-06-14 — Waves 0-2 implemented + cross-package integration

Eight sub-directories implemented by parallel agents across three waves, all
verified end-to-end.

**Waves shipped:**
- Wave 0 — `packages/domain` (Zod schemas, JSON Schema export, 19 tests),
  `packages/prompts` (loader + 6 v1 prompts + eval runner, 32 tests),
  `packages/ui` (theme preset, 9 components, Lottie placeholders, Storybook).
- Wave 1 — `packages/db` (Drizzle schema for all 12 entities, pgvector,
  migrations, stable demo seed), `infra/inngest` (4 functions + typed Coach
  HTTP client + DbAdapter interface, 27 tests), `apps/coach` (FastAPI with
  all 6 endpoints, prompt caching, hand-rolled Pydantic subset, 31 pytest).
- Wave 2 — `apps/web` (Next.js 15 + React 19, JWT next-auth, 13 API routes,
  11 pages, Drizzle DbAdapter wired at boot, 7 tests, build passes),
  `scripts/` (check-env, db-reset, seed, gen-pydantic, evals orchestrator).

**Integration follow-ups applied:**
- `RecalibrateRoadmapRequest/Response` moved from `infra/inngest/src/coach-client.ts`
  to `packages/domain/src/api/goals.ts`; `coach-client.ts` now aliases the
  domain types. JSON Schema export refreshed (75 schemas).
- `infra/inngest`: K-factor decay (32 → 16 → 8) implemented via
  `kFactorForExpertise(expertise)` and threaded through `computeExpertiseDelta`.
- `packages/ui`: `PunchType` now imported from `@notomorrow/domain`
  (removed local redeclaration); added `@notomorrow/domain` as a `dependencies`
  entry in `packages/ui/package.json` so the link is explicit.
- `arch/TRACKER.md` status table flipped to `done` for every track; interface
  contracts updated to match what was actually shipped.

**Known open items (parked, non-blocking):**
- Real Lottie art for KO/bell/swoosh — placeholder JSON in use.
- Persona-include semantics in `@notomorrow/prompts` loader (Coach Service
  stitches manually for v1).
- Per-user cron strategy at non-trivial scale (current: hourly tick + fan-out).
- `apps/web` onboarding does not yet persist the diagnostic to a
  `RatingProfile` row — UI shows the computed initial rating but a
  `POST /api/onboarding/diagnostic` route is still TODO.
- `infra/inngest` `getProofForVerification` hard-codes `domain='web-frontend'`
  and `difficulty=1200` — fine for single-domain MVP.

## 2026-06-14 — Sub-directory plans + coordination tracker

- Spread the architecture across per-directory `PLAN.md` files so multiple
  agents can execute in parallel without re-reading the whole `arch/` folder.
- Created `PLAN.md` in: `packages/domain`, `packages/db`, `packages/ui`,
  `packages/prompts`, `apps/coach`, `apps/web`, `infra/inngest`, `scripts`.
- Each plan declares: mission, scope (in/out), upstream dependencies,
  exposed interface, ordered build steps, acceptance criteria, verification
  commands, deferred items, open questions, coordination notes.
- Added [TRACKER.md](./TRACKER.md) as the live coordination doc: dependency
  graph, wave plan, status table, interface contracts agents can stub
  against, breaking change protocol, daily handoff convention.
- Updated [README.md](./README.md) with the Coordination section linking to
  TRACKER + every PLAN.

## 2026-06-14 — Repository layout added

- Decided on monorepo topology with pnpm workspaces + Turborepo orchestrating a
  polyglot tree (TS apps + Python Coach Service via uv).
- Sketched full repo tree: `apps/{web,coach}`, `packages/{db,domain,ui,prompts}`,
  `infra/{docker,inngest,terraform}`, `scripts/`.
- Picked initial tooling: Drizzle ORM, Zod, Biome, Ruff + mypy, Inngest,
  Docker Compose for local Postgres/Redis/MinIO.
- Established contract sync pattern: Zod schemas in `packages/domain` are the
  source of truth; Pydantic mirrors are codegen'd from JSON Schema in CI.
- Prompts versioned as markdown files in `packages/prompts`, read by both
  runtimes; eval suite gates merges that touch them.
- Docs touched: created [10-repo-layout.md](./10-repo-layout.md); updated
  README index.

## 2026-06-14 — Initial architecture captured

- First pass at the full architecture, split into 9 focused documents under `arch/`.
- Establishes: product pillars, domain model, two-axis rating system
  (Stamina + Expertise), Next.js + FastAPI service split, Claude Opus 4.7 +
  Haiku 4.5 LLM mix with prompt caching, MVP scope targeting the single-domain
  proof-by-URL loop.
- Open questions enumerated in [09-risks.md](./09-risks.md): domain taxonomy
  shape, combined-vs-per-domain rating, multiplayer rivals, coach voice modes,
  bundle moderation, pricing, mobile strategy.
- Docs created: README, 01-product, 02-domain-model, 03-rating-system,
  04-frontend, 05-backend, 06-coach-loop, 07-api, 08-mvp, 09-risks.
