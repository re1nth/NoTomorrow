# scripts — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 2.** Light track; depends on `packages/db` and `packages/prompts`.

## Mission

Repo-wide dev and operational scripts. Things every contributor runs that
don't belong inside any single app or package.

## Scope

**In:**
- `db-reset.ts` — drop + recreate local DB, reapply migrations, reseed
- `seed.ts` — wraps `@notomorrow/db` seed for convenience
- `evals/runner.ts` — repo-level orchestrator that calls `packages/prompts`
  and `apps/coach` eval runners and prints a combined report
- `gen-pydantic.ts` — runs the JSON Schema → Pydantic codegen step (also
  invoked from `apps/coach`, exposed here for ad-hoc use)
- `check-env.ts` — validates all required env vars are present per `.env.example`

**Out:**
- App-specific scripts (live in the app's `package.json`)
- Deploy scripts (live in `infra/`)

## Dependencies (consumes)

- `@notomorrow/db` — schema + seed
- `@notomorrow/domain` — JSON Schema for codegen
- `@notomorrow/prompts` — eval suite

## Exposes

- Pnpm scripts wired at repo root:
  - `pnpm db:reset`
  - `pnpm db:seed`
  - `pnpm evals`
  - `pnpm gen:pydantic`
  - `pnpm check:env`

## Build steps (ordered)

1. Choose a runner: `tsx` for zero-config TS execution
2. `db-reset.ts` first (most-used)
3. `seed.ts`
4. `check-env.ts` — reads `.env.example`, asserts each key present in
   `process.env`
5. `gen-pydantic.ts`
6. `evals/runner.ts`
7. Document each script in repo root `README.md`

## Acceptance criteria

- [ ] All scripts callable via `pnpm` from repo root
- [ ] `db-reset` is idempotent and safe to run repeatedly
- [ ] `check-env` produces a clear diff when vars are missing
- [ ] Documented in repo root README

## Verification

```
pnpm check:env
pnpm db:reset
pnpm db:seed
pnpm evals -- --quick
```

## Deferred / out of scope

- CI-specific scripts (lives in `.github/workflows/`)
- Production data migration scripts

## Open questions

- Should `evals` block on first failure or run the full suite? Recommendation:
  run full, summarize at end (CI gates on summary).

## Coordination

- These scripts call into other packages — if a script breaks because of a
  package change, the package owner fixes it. Update this PLAN if a new
  script becomes needed.

## Handoff notes

_None yet._
