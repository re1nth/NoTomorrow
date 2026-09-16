# NoTomorrow

A GitHub-style streak tracker. Name a thread (gym, badminton, builder), tap
**+1 today**, watch the contribution grid fill in.

Live at [plusonesan.com](https://plusonesan.com).

![NoTomorrow landing page](./docs/home.png)

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Auth.js v5 — email + password, plus optional Google / GitHub / Microsoft / Facebook OAuth
- SQLite (better-sqlite3) via Drizzle
- Tailwind 3 with the `@notomorrow/ui` preset

## Local development

Requires Node `>= 20` and `pnpm >= 9`.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# then set AUTH_SECRET (openssl rand -hex 32) and SQLITE_DB_PATH
```

Apply migrations to the local SQLite file once, then start Next:

```bash
cd apps/web && node -e "
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const sqlite = new Database(process.env.SQLITE_DB_PATH);
  sqlite.pragma('foreign_keys = ON');
  migrate(drizzle(sqlite), { migrationsFolder: '../../packages/db-sqlite/migrations' });
  sqlite.close();
"

pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up with any
email + password. OAuth providers are optional — each appears on `/login`
only when its `AUTH_<provider>_ID` and `AUTH_<provider>_SECRET` are both
set. See `apps/web/.env.example` for the full reference.

## Repo layout

```
apps/web              Next.js 15 web app
packages/db-sqlite    SQLite schema, migrations, and Drizzle client
packages/ui           Theme tokens, base components, Lottie assets
scripts               Deploy + health-check scripts
docs/                 Design notes and release runbooks
```

## Useful scripts

```bash
pnpm --filter web dev        # next dev
pnpm --filter web build      # next build
pnpm --filter web test       # vitest
pnpm lint                    # biome check
pnpm typecheck               # turbo run typecheck
```

## Deploying

Production runs on a DigitalOcean droplet — see
[`docs/release/hosting-digitalocean.md`](./docs/release/hosting-digitalocean.md)
for the one-time setup runbook. Updates are one line from your Mac:

```bash
ssh deploy@<droplet> 'cd ~/NoTomorrow && bash scripts/deploy.sh'
```

`scripts/deploy.sh` pulls, installs, applies migrations, builds Next,
restarts the systemd unit, and runs a health check.
