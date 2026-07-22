# scripts

Repo-wide developer & ops scripts. Every script here is callable from the repo
root via a `pnpm <name>` alias defined in the top-level `package.json` — there
is intentionally no `scripts/package.json`.

## Script index

| Command        | File                 | What it does                                                                        |
| -------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `pnpm desktop` | `install-desktop.sh` | Build the `.app`, install it into `/Applications`, strip quarantine, launch it.     |

## Conventions

- **Bash for pure shell orchestration.** `install-desktop.sh` is macOS-first
  developer glue (`osascript`, `xattr`, `open`). Writing it in TS would be
  Node shelling out the whole time; bash is honest here.
- **Friendly failure modes.** The script exits with a clear one-line error
  when prerequisites are missing (missing `pnpm`, wrong arch, etc.).
