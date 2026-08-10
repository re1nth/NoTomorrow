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
import { copyFileSync, cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

// electron-rebuild -m stageDir does not reach into Next's standalone
// pnpm layout, so `next build`'s fresh Node-ABI better_sqlite3.node
// stays in place — the Electron process then dies on dlopen. Overwrite
// every copy with the workspace-root native binary, which the desktop
// package's own `electron-rebuild` step has just rebuilt against
// Electron's ABI. Idempotent by content, keyed by file name.
const NATIVE = 'better_sqlite3.node';
const canonical = findNativeBinary(join(repoRoot, 'node_modules'), NATIVE);
if (!canonical) {
  throw new Error(
    `[notomorrow] could not find ${NATIVE} in the workspace root — run \`pnpm --filter desktop electron-rebuild\` first.`,
  );
}
// Rewrite in the staged tree (what electron-builder ships) and in the
// source standalone tree (what the .app's symlinks resolve to at
// runtime — the .app is not fully self-contained today).
let rewrites = 0;
for (const root of [stageDir, standaloneDir]) {
  for (const target of findAllNativeBinaries(root, NATIVE)) {
    copyFileSync(canonical, target);
    rewrites += 1;
  }
}
console.log(`[notomorrow] rewrote ${rewrites} copies of ${NATIVE} with Electron-ABI build`);

console.log('[notomorrow] web staged');

function findNativeBinary(root, name) {
  for (const found of findAllNativeBinaries(root, name)) return found;
  return null;
}

function findAllNativeBinaries(root, name) {
  const results = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue; // avoid symlink cycles + escaping the tree
      if (entry.isDirectory()) {
        stack.push(p);
      } else if (entry.isFile() && entry.name === name) {
        try {
          if (statSync(p).size > 0) results.push(p);
        } catch {
          // ignore
        }
      }
    }
  }
  return results;
}
