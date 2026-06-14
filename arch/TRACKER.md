# Build Tracker

Coordination hub for parallel work across the monorepo. Each sub-directory has
its own `PLAN.md` with mission, scope, dependencies, and acceptance criteria.
This file is the cross-cutting view: who is doing what, what depends on what,
and the interface contracts each package promises to expose so downstream
agents can build against stubs.

## How to use this file

If you are picking up work in a sub-directory:

1. Read the `PLAN.md` in that directory for your scope and definition of done.
2. Read this file's **Interface contracts** section to understand the stubs you
   can rely on from upstream packages.
3. Update your row in the **Status** table when you start, finish, or block.
4. If you must change an interface this file declares, follow the
   **Breaking change protocol** below.

## Dependency graph

```
              packages/domain  (Zod schemas, the contracts)
              /     |       \
             v      v        v
   packages/db  packages/prompts  packages/ui
       |              |               |
       |              v               |
       |          apps/coach          |
       |          /       \           |
       v         v         v          v
   infra/inngest      apps/web  ──────┘
       \                  /
        \                /
         v              v
         (deployed product)
```

`packages/ui` and `packages/prompts` have no code dependencies on
`packages/domain`, but in practice their content references the same entities,
so the domain shapes should land first to avoid rework.

## Wave plan

All eight tracks can start in parallel **if** Wave 0 publishes interface stubs
up front (Zod schema signatures, prompt names + arg shapes, component API).
Without those stubs, downstream agents will block.

- **Wave 0 (start immediately, publish stubs early):**
  `packages/domain`, `packages/prompts`, `packages/ui`
- **Wave 1 (start after Wave 0 stubs published):**
  `packages/db`, `infra/inngest`, `apps/coach`
- **Wave 2 (start after Wave 1 stubs published):**
  `apps/web`, `scripts`

In practice an agent can begin scaffolding (package init, deps, lint config) in
any track at any time — only the integration steps depend on upstream stubs.

## Status

Statuses: `not started` | `scaffolding` | `in progress` | `blocked` | `review` | `done`

Update the row when state changes. Keep the timestamp current (UTC date is fine).

| Path | Owner | Status | Updated | Blocked on |
|---|---|---|---|---|
| `packages/domain` | wave-0 agent | done | 2026-06-14 | — |
| `packages/prompts` | wave-0 agent | done | 2026-06-14 | — |
| `packages/ui` | wave-0 agent | done | 2026-06-14 | — |
| `packages/db` | wave-1 agent | done | 2026-06-14 | — |
| `infra/inngest` | wave-1 agent | done | 2026-06-14 | — |
| `apps/coach` | wave-1 agent | done | 2026-06-14 | — |
| `apps/web` | wave-2 agent | done | 2026-06-14 | — |
| `scripts` | wave-2 agent | done | 2026-06-14 | — |

All eight tracks shipped. Verification across the repo (run from root):
`pnpm --filter @notomorrow/domain build` (19/19 tests),
`pnpm --filter @notomorrow/prompts test` (32/32),
`pnpm --filter @notomorrow/inngest test` (27/27),
`pnpm --filter web test` (7/7), `pnpm --filter web build` (17 routes),
`pnpm --filter @notomorrow/ui build`, `pnpm --filter @notomorrow/db typecheck`,
`uv run pytest` in `apps/coach` (31/31 tests with mocked Anthropic).

## Interface contracts

Snapshot of what each upstream track promises. Downstream agents can stub
against these while upstream is in flight. Any change requires the breaking
change protocol below.

### `@notomorrow/domain`
- Zod schemas matching [02-domain-model.md](./02-domain-model.md)
- Import shape: `import { Goal, Task, Milestone, ... } from '@notomorrow/domain'`
- JSON Schema export at `packages/domain/dist/json-schema.json` (consumed by
  `apps/coach` Pydantic codegen)

### `@notomorrow/db`
- `createDb(url): DrizzleClient`
- Per-entity schema exports: `import { goals, tasks, ... } from '@notomorrow/db/schema'`
- Migrations runnable via `pnpm --filter @notomorrow/db migrate`

### `@notomorrow/ui`
- Components: `Button, Card, KOStamp, BellRing, RoundDial, RatingSparkline,
  CoachBubble, PunchIcon`
- Tailwind preset: `@notomorrow/ui/tailwind`
- Lottie assets exported as JSON imports

### `@notomorrow/prompts`
- File layout: `packages/prompts/{category}/{name}.v{n}.md`
- Frontmatter: `model`, `cache_breakpoints`, `inputs`, `version`
- TS loader: `loadPrompt({ category, name, version }): PromptDef`
- Python loads files directly via filesystem path

### `apps/coach` (HTTP API consumed by `apps/web` and `infra/inngest`)
- `POST /roadmap/generate` — SSE stream of `RoadmapStreamEvent` (matches `Api.RoadmapStreamEvent`)
- `POST /roadmap/recalibrate` — JSON `Api.RecalibrateRoadmapResponse`
- `POST /proof/grade` — JSON `Api.GradeProofResponse` (`{shipped, quality, gaps[]}`)
- `POST /coach/daily` — JSON `Api.DailyCoachResponse` (`{primaryTask, stretchTask, coachLine}`)
- `POST /coach/chat` — SSE `Api.ChatStreamEvent`
- `GET /healthz` — liveness
- Auth: shared service token via `Authorization: Bearer <COACH_SERVICE_TOKEN>` on all non-health endpoints

### `infra/inngest` (functions registered with the Inngest dev server)
- `daily-coach` — cron, per-user timezone
- `weekly-recalibrate` — cron, Sunday 20:00 user-local
- `streak-decay` — hourly tick
- `verify-proof` — on-demand, triggered by `apps/web`

## Breaking change protocol

If you must change a published interface listed above:

1. Add a row to **Pending interface changes** below describing the change.
2. Notify downstream owners (set their row's `Blocked on` to your change ID).
3. Wait for downstream acknowledgement before merging.
4. Once shipped, update the **Interface contracts** section here and append a
   dated entry to [CHANGELOG.md](./CHANGELOG.md).

### Pending interface changes

_None._ Wave-2 integration moved `RecalibrateRoadmapRequest/Response` into
`@notomorrow/domain` (was inline in `infra/inngest`); `packages/ui` now imports
`PunchType` from `@notomorrow/domain` instead of redeclaring it. See
[CHANGELOG.md](./CHANGELOG.md).

## Cross-track conventions

- **Package manager:** pnpm (JS), uv (Python)
- **Node:** 20+, **Python:** 3.12+
- **Lint/format:** Biome (JS), Ruff + mypy (Python)
- **Commits:** conventional commits, scope is the package touched
  (e.g. `feat(db): add ratings schema`)
- **Branches:** `feat/<track>-<short-desc>`, e.g. `feat/coach-roadmap-endpoint`
- **PR size:** keep PRs scoped to one track; cross-track changes need both
  owners on review

## Daily handoff

If you're stepping away mid-track, before you stop:

- Update your row's status (`in progress` → `blocked` or back to `not started`
  if undoing)
- Add a one-line note to the bottom of your `PLAN.md` under a `## Handoff notes`
  section so the next agent has context
- If you discovered an interface gap, add it under **Pending interface changes**
