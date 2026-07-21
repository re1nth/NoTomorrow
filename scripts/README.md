# scripts

Repo-wide developer & ops scripts. Every script here is callable from the repo
root via a `pnpm <name>` alias defined in the top-level `package.json` — there
is intentionally no `scripts/package.json`. We use `tsx` (root devDep) to run
TypeScript directly and stick to Node built-ins so this directory has zero
dependency surface of its own.

## Script index

| Command          | File                 | What it does                                                                              |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm desktop`   | `install-desktop.sh` | Build the `.app`, install it into `/Applications`, strip quarantine, launch it.           |
| `pnpm web`       | `dev-web.sh`         | Ensure `.env` + Postgres + migrations, then `next dev` on `:3000`.                        |
| `pnpm check:env` | `check-env.ts`       | Diff `process.env` against `.env.example`. Exits 1 with a list of missing keys.           |
| `pnpm db:reset`  | `db-reset.ts`        | DROP+CREATE the `public` (and `drizzle`) schemas, then re-apply migrations. Guarded.      |

## Conventions

- **TS scripts use `tsx` + Node built-ins only** — no new deps at the repo
  root. If a script needs a third-party module (e.g. `postgres`), it
  `await import()`s it so a missing workspace install surfaces a friendly
  error instead of a top-level resolution crash.
- **Bash for pure shell orchestration.** `install-desktop.sh` and
  `dev-web.sh` are macOS-first developer glue (`osascript`, `xattr`,
  `docker compose`, `open`). Writing them in TS would be Node shelling out
  the whole time; bash is honest here.
- **Friendly failure modes.** Every script exits with a clear one-line error
  when prerequisites are missing (missing env var, no `.env.example`, etc.).
- **Idempotent where possible.** `db:reset` can be re-run safely.

## Examples

```bash
# 1. Validate env before doing anything else.
pnpm check:env

# 2. Local DB lifecycle (Postgres must be running — typically `docker compose up -d postgres`).
ALLOW_DB_RESET=1 pnpm db:reset
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
runs in two steps:

1. Open a single connection and run `DROP SCHEMA … CASCADE; CREATE SCHEMA public;`.
2. Shell out to `pnpm --filter @notomorrow/db migrate`.
