# NoTomorrow

A GitHub-style streak tracker. Name a thread (gym, badminton, builder), tap
**+1 today**, watch the contribution grid fill in.

![NoTomorrow landing page](./docs/home.png)

## Install

Requires macOS on Apple Silicon, `pnpm >= 9`, Node `>= 20`, and Xcode
Command Line Tools. Data lives locally in SQLite — no Docker, no Postgres,
no manual migrations.

```bash
pnpm install
pnpm desktop
```

The script builds the `.app`, installs it into `/Applications`, strips the
macOS quarantine bit (the build is unsigned), and launches it. Re-run
`pnpm desktop` after any code change — same command works for updates.

User data path: `~/Library/Application Support/NoTomorrow/`.

## Repo layout

```
apps/web              Next.js 15 renderer used by the Electron app
apps/desktop          Electron launcher (.dmg)
packages/db-sqlite    SQLite schema + migrations + client
packages/ui           Theme tokens, base components, Lottie assets
scripts               Repo-wide dev scripts
```

## Useful scripts

```bash
pnpm lint            # biome check
pnpm typecheck       # turbo run typecheck
pnpm test            # turbo run test
pnpm build:desktop   # produce a shareable .dmg without installing
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
