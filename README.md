# NoTomorrow

A GitHub-style streak tracker. Name a thread (gym, badminton, builder), tap
**+1 today**, watch the contribution grid fill in.

![NoTomorrow landing page](./docs/home.png)

## Two ways to run

Both paths assume you've cloned the repo and have `pnpm >= 9` and Node `>= 20`.

### Mac desktop app — one command

Zero Docker, zero Postgres, zero manual migrations. Data lives locally in
SQLite. Requires macOS on Apple Silicon and Xcode Command Line Tools.

```bash
pnpm install
pnpm desktop
```

That's it. The script builds the `.app`, installs it into `/Applications`,
strips the macOS quarantine bit (the build is unsigned), and launches it.
Re-run `pnpm desktop` after any code change — same command works for updates.

User data path: `~/Library/Application Support/NoTomorrow/`.

### Web app — one command

For working on the UI or the REST API. Requires Docker Desktop.

```bash
pnpm install
pnpm web
```

`pnpm web` copies `.env.example` → `.env` on first run, brings up Postgres
via docker-compose, applies migrations, and starts `next dev` on
[http://localhost:3000](http://localhost:3000). Re-run to restart the dev
server (Postgres stays up between runs).

## Repo layout

```
apps/web              Next.js 15 app (UI + REST API)
apps/desktop          Electron launcher (.dmg)
packages/db           Drizzle Postgres schema + migrations + client
packages/db-sqlite    SQLite mirror used by the desktop build
packages/ui           Theme tokens, base components, Lottie assets
scripts               Repo-wide dev scripts
```

## Useful scripts

```bash
pnpm lint            # biome check
pnpm typecheck       # turbo run typecheck
pnpm test            # turbo run test
pnpm build:desktop   # produce a shareable .dmg without installing
pnpm db:reset        # drop + recreate + re-apply migrations (local only)
pnpm check:env       # validate .env against .env.example
```

## Uninstall the desktop app

```bash
rm -rf /Applications/NoTomorrow.app
rm -rf ~/Library/Application\ Support/NoTomorrow
```

## Notes

- **Unsigned build.** `pnpm desktop` clears the Gatekeeper quarantine bit
  automatically. If you distribute the `.dmg` from `pnpm build:desktop` to
  someone else, they'll need to run
  `xattr -dr com.apple.quarantine /Applications/NoTomorrow.app` themselves
  (or codesigning + notarization; deferred to a v2 packaging pass).
- **Repo path is baked in.** The installed `.app` launches Next from this
  repo's source tree. If you move the repo, re-run `pnpm desktop`, or set
  `NOTOMORROW_REPO_DIR=/new/path` before launching.
- **Existing Postgres volume from the pgvector image.** If you ran this repo
  before the switch to stock `postgres:16` and have a persisted
  `postgres_data` volume, the container will refuse to start. Wipe it once:
  `docker compose down -v` (destroys local Postgres data).
