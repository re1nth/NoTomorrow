/**
 * check-env — verify required env vars from `.env.example` are present in
 * `process.env`. Exits 1 with a clear diff if any are missing.
 *
 * Rules:
 *   - Every uncommented `KEY=...` line in `.env.example` is required.
 *   - A key is considered "present" if it's set to a non-empty value, OR if
 *     the `.env.example` line provides a non-empty default (treated as opt-in
 *     dev fallback worth flagging at info level, not as a failure).
 *
 * Usage:
 *   pnpm check:env
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface EnvEntry {
  key: string;
  hasDefault: boolean;
}

function parseExample(text: string): EnvEntry[] {
  const out: EnvEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    out.push({ key, hasDefault: value.length > 0 });
  }
  return out;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..');
  const examplePath = resolve(repoRoot, '.env.example');

  if (!existsSync(examplePath)) {
    console.error(`${RED}check-env:${RESET} .env.example not found at ${examplePath}`);
    process.exit(1);
  }

  const entries = parseExample(readFileSync(examplePath, 'utf8'));
  if (entries.length === 0) {
    console.log(`${YELLOW}check-env:${RESET} no keys declared in .env.example`);
    return;
  }

  const missing: string[] = [];
  const usingDefault: string[] = [];

  for (const { key, hasDefault } of entries) {
    const v = process.env[key];
    if (v && v.length > 0) continue;
    if (hasDefault) {
      usingDefault.push(key);
    } else {
      missing.push(key);
    }
  }

  if (usingDefault.length > 0) {
    console.log(`${DIM}check-env: ${usingDefault.length} key(s) unset but have an example default:${RESET}`);
    for (const k of usingDefault) {
      console.log(`  ${DIM}- ${k}${RESET}`);
    }
  }

  if (missing.length > 0) {
    console.error(`\n${RED}check-env: missing ${missing.length} required env var(s):${RESET}`);
    for (const k of missing) {
      console.error(`  ${RED}- ${k}${RESET}`);
    }
    console.error(
      `\n${DIM}Set them in your shell or copy .env.example to .env and fill them in.${RESET}`,
    );
    process.exit(1);
  }

  console.log(
    `${GREEN}check-env: OK${RESET} (${entries.length - usingDefault.length}/${entries.length} set from environment)`,
  );
}

main();
