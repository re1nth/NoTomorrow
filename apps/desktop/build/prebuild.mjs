#!/usr/bin/env node
/**
 * Pre-build step for the desktop app.
 *
 * Captures the absolute repo root at build time and stamps it into
 * build/repo-config.json. electron-builder ships that file as a resource;
 * paths.ts reads it at runtime to locate `apps/web`. This is what lets the
 * packaged .app launch the local source without the user passing a path.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const config = { repoRoot, generatedAt: new Date().toISOString() };
const out = resolve(here, 'repo-config.json');
writeFileSync(out, JSON.stringify(config, null, 2));
console.log(`[notomorrow] stamped repo path -> ${out}\n               ${repoRoot}`);
