# 10 — Repository Layout

How the code is organized, how packages relate, how local dev works, and how CI
gates changes. Decisions here should track the service split in
[05-backend.md](./05-backend.md).

## Topology decision: monorepo

Single repo with workspaces. Reasons:

- Frontend, App API, and Coach Service iterate together in the early phase
- Shared domain types and prompt assets benefit from one source of truth
- One CI pipeline, one PR review surface, one issue tracker
- Polyglot (TS + Python) is fine inside a monorepo with the right tooling

Polyrepo can be revisited if/when team and service surface grow enough that
deploy independence outweighs coupling cost.

## Tooling

- **pnpm** workspaces for JS/TS package graph
- **Turborepo** for task orchestration (build / lint / test / dev), with
  remote cache once team grows
- **uv** for the Python service (fast, replaces poetry/pip-tools)
- **TypeScript** across all JS
- **Drizzle ORM** for Postgres schema + migrations (TS-native, simple, fast)
- **Zod** for runtime validation; types feed both API contracts and forms
- **Biome** for lint + format (one tool, fast); ESLint only if a plugin is missing
- **Ruff + mypy** for Python lint + types
- **Docker Compose** for local Postgres + Redis + MinIO
- **GitHub Actions** for CI

## Top-level layout

```
notomorrow/
├── apps/
│   ├── web/                 Next.js 15 app — frontend + App API routes
│   └── coach/               Python FastAPI Coach Service
├── packages/
│   ├── db/                  Drizzle schema, migrations, client factory
│   ├── domain/              Zod schemas + inferred TS types (shared contracts)
│   ├── ui/                  Shared React components, theme tokens, Lottie assets
│   └── prompts/             Versioned LLM prompts (markdown + loader)
├── infra/
│   ├── docker/              Dockerfiles for prod images
│   ├── inngest/             Job definitions (TS, imported by web)
│   └── terraform/           (later) cloud infrastructure
├── scripts/
│   ├── db-reset.ts          Drop + recreate local DB
│   ├── seed.ts              Insert demo data for local dev
│   └── evals/               Coach eval suite runner
├── arch/                    This folder
├── .github/workflows/       CI definitions
├── docker-compose.yml       Local Postgres + Redis + MinIO
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── biome.json
├── .env.example
└── README.md
```

## App: `apps/web`

```
apps/web/
├── app/                     Next.js App Router
│   ├── (marketing)/         Public landing, bundle browsing
│   ├── (app)/               Authenticated surfaces
│   │   ├── gym/             Home / today's training
│   │   ├── goals/[id]/      Goal + roadmap views
│   │   ├── rating/          Rating dashboard
│   │   └── rivals/          Leaderboard
│   └── api/                 Route handlers (the App API from 05-backend.md)
│       ├── goals/
│       ├── tasks/
│       ├── training-log/
│       ├── coach/
│       └── webhooks/github/
├── components/              Page-specific components
├── lib/
│   ├── auth.ts              next-auth config
│   ├── db.ts                Drizzle client (re-exports from packages/db)
│   ├── coach-client.ts      Typed HTTP client to Coach Service
│   └── queue.ts             Inngest client
├── public/                  Static + Lottie JSON files
├── styles/                  Tailwind base + theme-ippo tokens
├── next.config.ts
└── package.json
```

## App: `apps/coach`

```
apps/coach/
├── src/
│   └── coach/
│       ├── main.py              FastAPI app entrypoint
│       ├── routers/
│       │   ├── roadmap.py       POST /roadmap/generate
│       │   ├── proof.py         POST /proof/grade
│       │   ├── daily.py         POST /coach/daily
│       │   └── chat.py          POST /coach/chat (SSE)
│       ├── llm/
│       │   ├── client.py        Anthropic SDK, with prompt caching
│       │   ├── persona.py       Loads coach persona prompt
│       │   └── schemas.py       Pydantic structured-output schemas
│       ├── prompts/             Thin loader for ../../../packages/prompts
│       ├── db.py                Read-only access via SQLAlchemy or asyncpg
│       └── settings.py          Pydantic Settings (env vars)
├── tests/
├── evals/                       Per-prompt eval cases + scoring
├── pyproject.toml
├── uv.lock
└── Dockerfile
```

The Coach Service reads from the same Postgres but is mostly stateless — App
API owns writes; Coach Service writes only `RatingEvent`, `CoachMessage`, and
roadmap rows it produces.

## Package: `packages/db`

```
packages/db/
├── schema/
│   ├── users.ts
│   ├── goals.ts
│   ├── roadmaps.ts
│   ├── tasks.ts
│   ├── proofs.ts
│   ├── training.ts
│   ├── ratings.ts
│   ├── bundles.ts
│   └── coach.ts
├── migrations/              Drizzle-generated SQL
├── client.ts                createDb(url) factory
├── seed/                    Local + test fixtures
└── package.json
```

Schema files map 1:1 to the entities in [02-domain-model.md](./02-domain-model.md).

## Package: `packages/domain`

Shared contracts that both web and (via codegen) the Coach Service can rely on.

```
packages/domain/
├── src/
│   ├── enums.ts             Punch types, statuses, channels
│   ├── goal.ts              Zod schemas for Goal, Roadmap, Milestone, Task
│   ├── proof.ts             ProofOfWork submission + grading result shapes
│   ├── rating.ts            RatingEvent, RatingProfile
│   ├── coach.ts             CoachMessage, chat payloads
│   └── index.ts
└── package.json
```

The Coach Service mirrors these as Pydantic models — generated from a JSON
Schema export of the Zod schemas, regenerated in CI. One source of truth, two
runtimes.

## Package: `packages/ui`

Shared React surface:

- `theme/` — Tailwind preset, color tokens, typography scale
- `components/` — Button, Card, KOStamp, BellRing, RoundDial, RatingSparkline
- `lottie/` — JSON animation assets

Consumed by `apps/web` and any future Storybook or marketing site.

## Package: `packages/prompts`

Prompts are markdown files with frontmatter:

```
packages/prompts/
├── roadmap/
│   ├── generate.v1.md
│   └── recalibrate.v1.md
├── proof/
│   └── grade.v1.md
├── coach/
│   ├── persona.v1.md            ~5k tokens, cache-hot
│   ├── daily-checkin.v1.md
│   └── chat-system.v1.md
└── loader.ts                    TS loader for the web app's debug UI
```

Both Python and TS read these as files. Versioning is in the filename so we can
A/B and roll back without losing history. Eval suite pins prompt versions.

## Infra: `infra/inngest`

Job definitions live in TS so they share the Drizzle schema. Imported by the
web app at boot:

```
infra/inngest/
├── daily-coach.ts           Cron 07:00 user-local — calls Coach Service
├── weekly-recalibrate.ts    Cron Sunday 20:00 user-local
├── streak-decay.ts          Hourly tick
└── verify-proof.ts          On-demand, enqueued from /tasks/:id/proof
```

## Local development

```
docker compose up -d           Postgres + Redis + MinIO
pnpm install                   Install JS deps
uv sync --project apps/coach   Install Python deps
pnpm db:migrate                Run Drizzle migrations
pnpm db:seed                   Seed demo data
pnpm dev                       Turbo runs web + coach + inngest in parallel
```

`pnpm dev` orchestrates:

- `apps/web` → `next dev` on :3000
- `apps/coach` → `uvicorn coach.main:app --reload` on :8000
- `inngest dev` → local job runner on :8288

## Environment variables

`.env.example` checked in, listing every required var with safe placeholders.
Each app reads only the vars it owns; nothing imports `process.env` directly
outside of `apps/*/lib/env.ts` (typed loader with Zod).

Production:
- `apps/web` → Vercel env vars
- `apps/coach` → Fly secrets

## CI gates

`.github/workflows/ci.yml`:

1. **Path filters** — only run changed app's jobs
2. **JS** — `pnpm lint && pnpm typecheck && pnpm test`
3. **Python** — `uv run ruff check && uv run mypy && uv run pytest`
4. **DB** — verify migrations apply cleanly to a fresh Postgres
5. **Prompts** — if any file under `packages/prompts/` changed, run the eval
   suite and block merge on regression beyond threshold
6. **Contract sync** — regenerate Pydantic from Zod; fail if diff

## Naming + conventions

- Repo root name: `notomorrow`
- Package names: `@notomorrow/db`, `@notomorrow/domain`, `@notomorrow/ui`,
  `@notomorrow/prompts`
- Python package: `coach`
- Branches: `main` is deployable; feature branches `feat/...`, `fix/...`
- Commits: conventional commits style, scope is the app/package touched
