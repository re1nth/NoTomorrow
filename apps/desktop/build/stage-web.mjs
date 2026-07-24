#!/usr/bin/env node
/**
 * Stages a self-contained apps/web tree with hoisted (non-symlinked)
 * node_modules into apps/desktop/build/web-staging/. electron-builder
 * ships that directory as an extraResource so the packaged .app runs on
 * any Mac — no source repo required.
 *
 * Steps:
 *   1. pnpm deploy --filter web --prod  → real files, workspace deps
 *      inlined into node_modules.
 *   2. Copy `.next/` and `public/` in (deploy respects .gitignore, which
 *      excludes the built output).
 *   3. electron-rebuild against the staged better-sqlite3 so the runtime
 *      finds an Electron-ABI binary instead of the Node-prebuilt one.
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

console.log(`[notomorrow] staging web -> ${stageDir}`);
rmSync(stageDir, { recursive: true, force: true });

execFileSync(
  'pnpm',
  ['--filter', 'web', 'deploy', '--prod', stageDir],
  { cwd: repoRoot, stdio: 'inherit' },
);

const nextOut = resolve(webDir, '.next');
if (!existsSync(nextOut)) {
  throw new Error(
    `[notomorrow] no .next/ at ${nextOut} — run \`pnpm --filter web build\` first`,
  );
}
cpSync(nextOut, resolve(stageDir, '.next'), { recursive: true });

// Prune build-time-only outputs from the staged .next/ — cache alone is
// ~130 MB of webpack scratch that plays no role in serving.
for (const junk of ['cache', 'trace', 'diagnostics', 'types']) {
  rmSync(resolve(stageDir, '.next', junk), { recursive: true, force: true });
}

const publicDir = resolve(webDir, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, resolve(stageDir, 'public'), { recursive: true });
}

// pnpm deploy respects the workspace tsconfig/vitest/tests; none of them
// run at serve time. Drop them so the DMG isn't shipping test fixtures.
for (const junk of ['tests', 'tsconfig.tsbuildinfo', 'vitest.config.ts', 'README.md']) {
  rmSync(resolve(stageDir, junk), { recursive: true, force: true });
}

console.log('[notomorrow] rebuilding native deps for Electron in staged tree');
execFileSync(
  'npx',
  ['electron-rebuild', '-f', '-w', 'better-sqlite3', '-m', stageDir],
  { cwd: desktopDir, stdio: 'inherit' },
);

console.log('[notomorrow] web staged');
