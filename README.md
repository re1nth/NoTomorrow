# NoTomorrow

A Hajime no Ippo–themed builder's gym. Set an audacious goal, get a coach-generated
roadmap, ship proof of work, watch your Stamina/Expertise ratings climb (or get
knocked down).

See [`arch/`](./arch/) for the full architecture. Start with
[`arch/README.md`](./arch/README.md).

## Repo layout

```
apps/web      Next.js 15 app (UI + REST API)
apps/coach    Python FastAPI Coach Service (LLM orchestration)
packages/db   Drizzle schema + migrations + client
packages/domain  Zod contracts shared across runtimes
packages/ui   Theme tokens, base components, Lottie assets
packages/prompts  Versioned LLM prompts + loader
infra/inngest Background job definitions
scripts       Repo-wide dev scripts
arch          Architecture docs, TRACKER, per-directory PLAN.md
```

## Local dev

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Runs:
- Web app on `:3000`
- Coach Service on `:8000`
- Inngest dev on `:8288`
- Postgres on `:5432`, Redis on `:6379`, MinIO on `:9000`/`:9001`

## Useful scripts

```bash
pnpm lint            # biome check
pnpm typecheck       # turbo run typecheck
pnpm test            # turbo run test
pnpm db:reset        # drop + recreate + reseed local db
pnpm evals           # run prompt eval suite
pnpm check:env       # validate .env against .env.example
pnpm gen:pydantic    # regenerate Pydantic models from domain JSON Schema
```

## Coordination

Per-directory `PLAN.md` files describe scope, deps, and acceptance criteria.
[`arch/TRACKER.md`](./arch/TRACKER.md) is the live status board with interface
contracts and the breaking-change protocol. Read it before starting work in any
sub-directory.
