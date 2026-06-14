# scripts

Repo-wide developer & ops scripts. Every script here is callable from the repo
root via a `pnpm <name>` alias defined in the top-level `package.json` — there
is intentionally no `scripts/package.json`. We use `tsx` (root devDep) to run
TypeScript directly and stick to Node built-ins so this directory has zero
dependency surface of its own.

## Script index

| Command               | File                  | What it does                                                                                              |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm check:env`      | `check-env.ts`        | Diff `process.env` against `.env.example`. Exits 1 with a list of missing keys.                           |
| `pnpm db:reset`       | `db-reset.ts`         | DROP+CREATE the `public` (and `drizzle`) schemas, re-apply migrations, re-seed. Guarded.                  |
| `pnpm db:seed`        | `seed.ts`             | Wraps `pnpm --filter @notomorrow/db seed` and prints `DEMO_USER_ID`.                                       |
| `pnpm gen:pydantic`   | `gen-pydantic.ts`     | Build the domain JSON Schema if needed, then run the Python codegen in `apps/coach`.                      |
| `pnpm evals`          | `evals/runner.ts`     | Run both eval halves (TS via `@notomorrow/prompts`, Python via `apps/coach`) with deterministic mocks.    |

## Conventions

- **No new deps.** Use `node:child_process`, `node:fs`, `node:path`,
  `node:url`, and ANSI escape codes. If a script needs a third-party module
  (e.g. `postgres`), it `await import()`s it so a missing workspace install
  surfaces a friendly error instead of a top-level resolution crash.
- **Friendly failure modes.** Every script exits with a clear one-line error
  when prerequisites are missing (missing env var, no `.env.example`, etc.).
- **Idempotent where possible.** `db:reset` can be re-run; `db:seed` uses
  `ON CONFLICT DO NOTHING` upstream.

## Examples

```bash
# 1. Validate env before doing anything else.
pnpm check:env

# 2. Local DB lifecycle (Postgres must be running — typically `docker compose up -d db`).
ALLOW_DB_RESET=1 pnpm db:reset
pnpm db:seed

# 3. Regenerate the Pydantic models from the domain JSON Schema.
pnpm gen:pydantic

# 4. Quick eval smoke test (filters to coach/daily-checkin on both halves).
pnpm evals --quick

# 5. Full eval suite, TS half only.
pnpm evals --ts-only

# 6. One prompt across both halves.
pnpm evals --prompt coach/daily-checkin
```

## `check-env`

Parses `.env.example` at the repo root and asserts each `KEY=` line is set in
the current `process.env`. Keys that have a non-empty example default (e.g.
`DATABASE_URL=postgres://...`) are reported in dim text rather than as a
failure, since the example is itself a workable dev value.

## `db-reset`

Destructive. Requires `--yes` or `ALLOW_DB_RESET=1`, and refuses to run if
`DATABASE_URL` looks like a managed/remote target (e.g. contains
`sslmode=require`, `amazonaws`, `render`, `fly.io`, `supabase`). The reset
runs in three steps:

1. Open a single connection and run `DROP SCHEMA … CASCADE; CREATE SCHEMA public;`.
2. Shell out to `pnpm --filter @notomorrow/db migrate`.
3. Shell out to `pnpm --filter @notomorrow/db seed`.

## `db:seed`

A thin wrapper around `pnpm --filter @notomorrow/db seed`. After the seed
completes it imports `@notomorrow/db` and prints the canonical `DEMO_USER_ID`
so you can paste it into your local URLs.

## `gen-pydantic`

Ensures `packages/domain/dist/json-schema.json` exists (running
`pnpm --filter @notomorrow/domain build` if needed), then `cd`s into
`apps/coach` and runs `uv run python scripts/gen_pydantic.py`. Any extra args
you pass to `pnpm gen:pydantic` after `--` are forwarded to the Python script.

## `evals/runner`

Orchestrates both eval halves so a contributor can run a single command to get
combined coverage:

- **TS half** — dynamic-imports `@notomorrow/prompts/eval-runner` and runs
  every discovered case with an in-process mock `LlmCaller`. The mock returns
  a structured object for `coach/daily-checkin` (so `hasKeys` rubrics pass)
  and echoes the rendered system text for everything else (so `contains`
  rubrics work against the prompt itself).
- **Python half** — spawns `uv run python -m evals.runner --mock` inside
  `apps/coach`, forwarding `--prompt` if provided. The orchestrator parses the
  trailing JSON report the Python runner prints so the summary table reflects
  real counts.

Flags:

| Flag                       | Effect                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| `--quick`                  | Filter both halves to `coach/daily-checkin` (the smoke case).           |
| `--prompt <cat>/<name>`    | Filter both halves to a specific prompt id.                             |
| `--ts-only`                | Skip the Python half. Useful when `uv`/`apps/coach` isn't installed.    |
| `--py-only`                | Skip the TS half. Symmetric counterpart.                                |

Exit code is `0` only if every executed half passed; failures in one half do
not short-circuit the other so CI gets the full picture in one run.
