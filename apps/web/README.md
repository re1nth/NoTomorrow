# apps/web — NoTomorrow

Next.js 15 (App Router) + React 19 renderer for the Electron desktop app.
There is no browser-facing "web version" — the launcher in `apps/desktop`
boots an in-process Next server, opens a BrowserWindow at it, and every
request is implicitly the single local user created on first boot.

## Stack

- Next 15, React 19, TypeScript
- Tailwind 3 with the `@notomorrow/ui` preset
- Drizzle via `@notomorrow/db-sqlite` (better-sqlite3)

## Running

Do not launch this package directly — run `pnpm desktop` from the repo root.
That builds the `.app`, installs it into `/Applications`, and launches it.
The launcher sets `SQLITE_DB_PATH`, applies migrations, and starts Next.

## Test

```bash
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test
```

## Notes

- All `@notomorrow/ui` imports are routed through `@/lib/ui` so the
  client/server boundary lives in one place (several UI components rely on
  React hooks).
- `lib/db.ts` is lazy: the SQLite connection is opened on first access, not
  at module load, so `next build`'s collect-page-data pass never touches the
  file.
