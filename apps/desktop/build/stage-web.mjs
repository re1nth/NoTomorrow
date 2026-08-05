#!/usr/bin/env node
/**
 * Stages Next's standalone output tree into apps/desktop/build/web-staging/.
 * electron-builder ships that directory as an extraResource so the packaged
 * .app runs on any arm64 Mac — no source repo required.
 *
 * Layout produced (mirrors what Next expects when running server.js):
 *   web-staging/
 *     apps/web/
 *       server.js           <- Next standalone entry
 *       package.json
 *       .next/              <- server chunks + copied static assets
 *       public/             <- copied from apps/web/public
 *     node_modules/         <- traced by Next (only files actually reached)
 *     package.json
 *
 * apps/desktop/src/main/server.ts forks apps/web/server.js in a child
 * process. Native modules (better-sqlite3) get rebuilt against the staged
 * tree so they match the Electron ABI.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(here, '..');
const repoRoot = resolve(desktopDir, '..', '..');
const webDir = resolve(repoRoot, 'apps', 'web');
const stageDir = resolve(here, 'web-staging');

const nextOut = resolve(webDir, '.next');
const standaloneDir = resolve(nextOut, 'standalone');
if (!existsSync(standaloneDir)) {
  throw new Error(
    `[notomorrow] no .next/standalone at ${standaloneDir} — run \`pnpm --filter web build\` first (next.config.ts must set output:'standalone').`,
  );
}

console.log(`[notomorrow] staging web -> ${stageDir}`);
rmSync(stageDir, { recursive: true, force: true });

// Copy the entire standalone tree. Includes apps/web/server.js, the
// tracer-selected node_modules, and the root package.json.
cpSync(standaloneDir, stageDir, { recursive: true });

// server.js expects static assets under apps/web/.next/static and
// public assets under apps/web/public — Next intentionally excludes both
// from the standalone tree (they're often served by a CDN).
const stagedWeb = resolve(stageDir, 'apps', 'web');
cpSync(resolve(nextOut, 'static'), resolve(stagedWeb, '.next', 'static'), { recursive: true });
const publicDir = resolve(webDir, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, resolve(stagedWeb, 'public'), { recursive: true });
}

// Rebuild native modules against Electron's ABI. `-m stageDir` tells
// electron-rebuild to walk the staged node_modules rather than the repo.
console.log('[notomorrow] rebuilding native deps for Electron in staged tree');
execFileSync(
  'npx',
  ['electron-rebuild', '-f', '-w', 'better-sqlite3', '-m', stageDir],
  { cwd: desktopDir, stdio: 'inherit' },
);

console.log('[notomorrow] web staged');
