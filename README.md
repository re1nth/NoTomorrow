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

Output: `apps/desktop/dist-electron/NoTomorrow-0.1.0-arm64.dmg`
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

# remove user data (SQLite db + Electron caches) — destroys your goals & log
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
