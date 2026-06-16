import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

export function getUserDataDir(): string {
  // Electron's per-user app folder. On macOS:
  //   ~/Library/Application Support/NoTomorrow
  // (uses the name set via app.setName in main.ts).
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSqliteDbPath(): string {
  return path.join(getUserDataDir(), 'notomorrow.db');
}

/**
 * Repo root for the local NoTomorrow source tree.
 *
 * Resolved in this order:
 *  1. `NOTOMORROW_REPO_DIR` env var (escape hatch for moved repos).
 *  2. `repo-config.json` baked into resources at build time.
 *  3. Walk up from __dirname to find a parent containing apps/web/package.json
 *     — covers `pnpm dev` runs against the source.
 */
function findRepoRoot(): string {
  const fromEnv = process.env.NOTOMORROW_REPO_DIR;
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'apps/web/package.json'))) {
    return fromEnv;
  }
  if (process.resourcesPath) {
    const configPath = path.join(process.resourcesPath, 'repo-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
          repoRoot?: string;
        };
        if (cfg.repoRoot && fs.existsSync(path.join(cfg.repoRoot, 'apps/web/package.json'))) {
          return cfg.repoRoot;
        }
      } catch {
        // fall through to dev resolution
      }
    }
  }
  // dev: apps/desktop/dist/main → apps/desktop → apps → repo root
  let cur = path.resolve(__dirname, '..', '..', '..', '..');
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, 'apps/web/package.json'))) return cur;
    cur = path.dirname(cur);
  }
  throw new Error(
    '[notomorrow] could not locate the NoTomorrow repo. Set NOTOMORROW_REPO_DIR to the absolute path of the repo root, or rebuild the .dmg after moving the repo.',
  );
}

let _repoRoot: string | null = null;
export function getRepoRoot(): string {
  if (!_repoRoot) _repoRoot = findRepoRoot();
  return _repoRoot;
}

export function getWebAppDir(): string {
  return path.join(getRepoRoot(), 'apps', 'web');
}

export function getMigrationsDir(): string {
  // Packaged builds ship the migrations folder via extraResources so the
  // .app keeps working even if the repo source ever drifts; dev falls back
  // to the source folder.
  if (process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, 'db-sqlite-migrations');
    if (fs.existsSync(packaged)) return packaged;
  }
  return path.join(getRepoRoot(), 'packages', 'db-sqlite', 'migrations');
}
