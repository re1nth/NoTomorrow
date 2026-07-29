# apps/web — NoTomorrow

Next.js 15 (App Router) + React 19. Runs in two modes:

- **Local** (`NOTOMORROW_AUTH=local`) — embedded by the Electron app in
  `apps/desktop`. Single implicit user, no login screen, SQLite file on
  disk.
- **Cloud** (`NOTOMORROW_AUTH=cloud`) — multi-tenant web service.
  Auth.js v5 with Google OAuth, session cookies, one shared SQLite file
  per deployment.

The seam is `lib/auth.ts`; every route handler is byte-identical in both
modes. Design doc: [`docs/web-hosting-plan.md`](../../docs/web-hosting-plan.md).

## Stack

- Next 15, React 19, TypeScript
- Tailwind 3 with the `@notomorrow/ui` preset
- Drizzle via `@notomorrow/db-sqlite` (better-sqlite3)
- Auth.js v5 (`next-auth@5`) + `@auth/drizzle-adapter` (cloud mode only)

## Running (local / desktop)

Do not launch this package directly — run `pnpm desktop` from the repo
root. That builds the `.app`, installs it into `/Applications`, and
launches it. The launcher sets `SQLITE_DB_PATH`, sets
`NOTOMORROW_AUTH=local`, applies migrations, and starts Next.

## Running (cloud) locally

For iterating on the hosted flow without deploying:

1. Create a throwaway Google OAuth client in the [Google Cloud
   Console](https://console.cloud.google.com/apis/credentials).
   Authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`.
2. Copy `.env.example` to `.env.local` (gitignored) and fill in the
   blanks:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # then edit AUTH_SECRET (openssl rand -hex 32), AUTH_GOOGLE_ID,
   # AUTH_GOOGLE_SECRET, and SQLITE_DB_PATH
   ```

3. Apply migrations against the local file once:

   ```bash
   mkdir -p apps/web/.data
   node -e "
     const Database = require('better-sqlite3');
     const { drizzle } = require('drizzle-orm/better-sqlite3');
     const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
     migrate(drizzle(new Database(process.env.SQLITE_DB_PATH)),
       { migrationsFolder: '../../packages/db-sqlite/migrations' });
   " 
   ```

   (run from `apps/web/`, with `SQLITE_DB_PATH` exported to the same
   path you set in `.env.local`).

4. `pnpm --filter web dev` and open <http://localhost:3000>. Signed-out
   requests land on `/login`; the Google button starts the OAuth flow.

If the Google callback loops back to `/login`, double-check that the
authorised redirect URI on the Google client matches
`http://localhost:3000/api/auth/callback/google` exactly.

## Environment variables

| Var | Local | Cloud | Purpose |
| --- | --- | --- | --- |
| `NOTOMORROW_AUTH` | `local` | `cloud` | Picks the auth strategy in `lib/auth.ts`. |
| `SQLITE_DB_PATH` | ✓ | ✓ | Absolute path to the SQLite file. Desktop sets it to `~/Library/Application Support/NoTomorrow/notomorrow.db`; cloud sets it to the volume mount (`/data/notomorrow.db`). |
| `AUTH_SECRET` |   | ✓ | Auth.js session cookie signing key. `openssl rand -hex 32`. |
| `AUTH_TRUST_HOST` |   | ✓ | Set to `true` behind a proxy/load balancer (Fly, Vercel, etc.) so Auth.js trusts the forwarded Host header. |
| `AUTH_GOOGLE_ID` |   | ✓ | Google OAuth client id. |
| `AUTH_GOOGLE_SECRET` |   | ✓ | Google OAuth client secret. |

## Deploying (Fly.io)

Not implemented yet — Phase 5 of the [hosting
plan](../../docs/web-hosting-plan.md#9-packaging-and-deploy). When it
lands, the pieces will be:

- `apps/web/Dockerfile` (multi-stage build + `next start`)
- `apps/web/docker-entrypoint.sh` (runs migrations against
  `/data/notomorrow.db`, then execs Next)
- `fly.toml` at the repo root, `NOTOMORROW_AUTH=cloud`, secrets set via
  `flyctl secrets set`
- `app/api/health/route.ts` for the Fly health check

## Test

```bash
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test
```

## Notes

- All `@notomorrow/ui` imports are routed through `@/lib/ui` so the
  client/server boundary lives in one place (several UI components rely
  on React hooks).
- `lib/db.ts` is lazy: the SQLite connection is opened on first access,
  not at module load, so `next build`'s collect-page-data pass never
  touches the file.
- `lib/nextauth.ts` is only imported dynamically from
  `lib/auth-cloud.ts`, so `NOTOMORROW_AUTH=local` never constructs the
  NextAuth instance and never needs the `AUTH_*` env vars.
