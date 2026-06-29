# apps/web — NoTomorrow

Next.js 15 (App Router) + React 19 user surface and App API.

## Stack

- Next 15, React 19, TypeScript
- Tailwind 3 with the `@notomorrow/ui` preset
- next-auth v4 (JWT sessions; dev credentials provider so the local flow works
  without OAuth keys)
- Drizzle via `@notomorrow/db` (Postgres) — webpack-aliased to
  `@notomorrow/db-sqlite` when `NOTOMORROW_RUNTIME=desktop`

## Dev startup

```bash
# from the repo root
pnpm install
docker compose up -d postgres
pnpm --filter @notomorrow/db migrate

# run the dev server
pnpm --filter web dev          # Next.js on :3000
```

Set the following in `.env.local` (or `.env`):

```
NEXTAUTH_SECRET=...                 # any random string for dev
DATABASE_URL=postgres://...
# Optional:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Golden-path walkthrough

1. Visit `http://localhost:3000` and click **Step into the ring**.
2. On `/sign-in`, enter any email — the dev credentials provider upserts you
   into the `users` table and creates a session.
3. You land on `/counters`. Click **+ New thread**, name it ("Gym"), pick a
   starting count, hit **Create**.
4. Tap **+1 today** to log a check-in (once per local day, enforced both at the
   API and via the `counter_check_ins` unique index).
5. Watch the 53-week heatmap below the belt/progress bar paint today's cell
   in the counter's belt color. Adjacent days fill in as the streak grows.

## Test

```bash
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test
```

## Notes

- Auth ships with a dev credentials provider so the full flow works without an
  SMTP server or OAuth keys. Google sign-in activates automatically when
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set.
- All `@notomorrow/ui` imports are routed through `@/lib/ui` so the
  client/server boundary lives in one place (several UI components rely on
  React hooks).
- `lib/env.ts` and `lib/db.ts` are lazy: env validation and pool creation
  happen on first access, not at module load, so `next build` can collect page
  data without infra.
- The desktop runtime swaps the Postgres schema for SQLite via a webpack alias
  in `next.config.ts` — every server-side build for the .app must set
  `NOTOMORROW_RUNTIME=desktop` so route handlers bind to the SQLite tables.
