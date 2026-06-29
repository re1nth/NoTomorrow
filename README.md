# NoTomorrow

A GitHub-style streak tracker. Name a thread (gym, badminton, builder), tap **+1
today**, watch the contribution grid fill in.

## Repo layout

```
apps/web              Next.js 15 app (UI + REST API)
apps/desktop          Electron launcher (.dmg)
packages/db           Drizzle Postgres schema + migrations + client
packages/db-sqlite    SQLite mirror used by the desktop build
packages/ui           Theme tokens, base components, Lottie assets
scripts               Repo-wide dev scripts
```

## Local dev

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm dev
```

Runs the web app on `:3000` and Postgres on `:5432`.

## Useful scripts

```bash
pnpm lint            # biome check
pnpm typecheck       # turbo run typecheck
pnpm test            # turbo run test
pnpm db:reset        # drop + recreate + re-apply migrations (local only)
pnpm check:env       # validate .env against .env.example
```

## Mac desktop app

`apps/desktop` is an Electron launcher that opens NoTomorrow as a native macOS
window — no `docker compose up`, no `pnpm dev`, no terminal. It runs against
the local source tree (so this machine, not portable to another), uses SQLite
instead of Postgres, and stores its data in
`~/Library/Application Support/NoTomorrow/`.

### Build the `.dmg`

```bash
# one-time: produce the .icns from the source PNG (needs python3 + Pillow)
pnpm --filter desktop run icon

# build the production web bundle + the .dmg
pnpm build:desktop
```

Output: `apps/desktop/dist-electron/NoTomorrow-<version>-arm64.dmg`
(about ~150 MB, Apple Silicon).

### Install

1. Double-click the `.dmg`. A window opens showing the NoTomorrow icon and
   an `Applications` shortcut.
2. Drag `NoTomorrow.app` onto `Applications`.
3. Eject the disk image.
4. **First launch (unsigned build):** macOS Gatekeeper will refuse the .app
   because it isn't notarized. One-time fix:
   ```bash
   xattr -dr com.apple.quarantine /Applications/NoTomorrow.app
   ```
   Then double-click `NoTomorrow` in Launchpad. From here on it's one click.

### Uninstall

```bash
# remove the application
rm -rf /Applications/NoTomorrow.app

# remove user data (SQLite db + Electron caches) — destroys your counters & history
rm -rf ~/Library/Application\ Support/NoTomorrow

# old dev-run cache, if you ever ran `pnpm --filter desktop dev`
rm -rf ~/Library/Application\ Support/desktop
```

### Repo dependency

The packaged .app launches the Next.js app from this repo's source. If you
move the repo, rebuild the .dmg or set `NOTOMORROW_REPO_DIR` to override the
baked-in path:

```bash
NOTOMORROW_REPO_DIR=/new/path/to/NoTomorrow open -a NoTomorrow
```
