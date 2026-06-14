/**
 * db-reset — wipe the local Postgres database, re-apply migrations, and re-seed.
 *
 * This is destructive. Guarded behind `--yes` or `ALLOW_DB_RESET=1`.
 *
 * Sequence:
 *   1. DROP SCHEMA public CASCADE; CREATE SCHEMA public;
 *      DROP SCHEMA drizzle CASCADE; (drizzle's bookkeeping)
 *   2. pnpm --filter @notomorrow/db migrate
 *   3. pnpm --filter @notomorrow/db seed
 *
 * `postgres` is dynamic-imported so this script can be parsed even if the
 * workspace install hasn't completed yet (e.g. CI bootstrap).
 *
 * Usage:
 *   pnpm db:reset --yes
 *   ALLOW_DB_RESET=1 pnpm db:reset
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    console.log(`${DIM}$ ${cmd} ${args.join(' ')}${RESET}`);
    const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
    child.on('error', rejectP);
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(`${RED}db-reset:${RESET} DATABASE_URL is required`);
    process.exit(1);
  }

  const confirmed = process.argv.includes('--yes') || process.env.ALLOW_DB_RESET === '1';
  if (!confirmed) {
    console.error(
      `${RED}db-reset:${RESET} refusing to reset. Pass ${YELLOW}--yes${RESET} or set ${YELLOW}ALLOW_DB_RESET=1${RESET}.`,
    );
    process.exit(1);
  }

  // Production guard: refuse to run against an obviously-prod URL.
  if (/sslmode=require/i.test(url) || /amazonaws|render|fly\.io|supabase/i.test(url)) {
    console.error(
      `${RED}db-reset:${RESET} DATABASE_URL looks like a remote/production target. Aborting.`,
    );
    process.exit(1);
  }

  // `postgres` ships as a dep of @notomorrow/db, not the repo root. Resolve it
  // from there so this script works without a `scripts/package.json`.
  const here = dirname(fileURLToPath(import.meta.url));
  const dbPkgDir = resolve(here, '..', 'packages/db');
  let postgresMod: typeof import('postgres');
  try {
    const requireFromDb = createRequire(resolve(dbPkgDir, 'package.json'));
    const postgresEntry = requireFromDb.resolve('postgres');
    postgresMod = (await import(pathToFileURL(postgresEntry).href)) as typeof import('postgres');
  } catch (err) {
    console.error(
      `${RED}db-reset:${RESET} could not load 'postgres' — run \`pnpm install\` and retry.`,
    );
    console.error(err);
    process.exit(1);
  }
  const postgres = postgresMod.default;

  console.log(`${YELLOW}db-reset:${RESET} dropping and recreating public schema…`);
  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    await client.unsafe('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.unsafe('CREATE SCHEMA public;');
    await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  } finally {
    await client.end({ timeout: 5 });
  }

  console.log(`${YELLOW}db-reset:${RESET} applying migrations…`);
  await run('pnpm', ['--filter', '@notomorrow/db', 'migrate']);

  console.log(`${YELLOW}db-reset:${RESET} seeding demo data…`);
  await run('pnpm', ['--filter', '@notomorrow/db', 'seed']);

  console.log(`${GREEN}db-reset: complete${RESET}`);
}

main().catch((err) => {
  console.error(`${RED}db-reset: failed${RESET}`);
  console.error(err);
  process.exit(1);
});
