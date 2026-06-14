/**
 * seed — convenience wrapper around `pnpm --filter @notomorrow/db seed`.
 *
 * Adds two niceties:
 *   - Validates `DATABASE_URL` up front so the error is one line, not a stack.
 *   - Prints `DEMO_USER_ID` on success so devs can copy/paste it into
 *     `/api/...?userId=` URLs or psql.
 *
 * Usage:
 *   pnpm db:seed
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RED = '\x1b[31m';
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
      else rejectP(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(`${RED}seed:${RESET} DATABASE_URL is required`);
    process.exit(1);
  }

  await run('pnpm', ['--filter', '@notomorrow/db', 'seed']);

  // Re-export the stable id from the db package so we don't drift if it moves.
  // `scripts/` has no package.json so we import the package's source file
  // directly via a file URL instead of relying on workspace resolution.
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const idsSrc = pathToFileURL(
      resolve(here, '..', 'packages/db/src/seed/ids.ts'),
    ).href;
    const mod = (await import(idsSrc)) as { DEMO_USER_ID?: string };
    if (mod.DEMO_USER_ID) {
      console.log(`${GREEN}seed: DEMO_USER_ID=${mod.DEMO_USER_ID}${RESET}`);
    }
  } catch {
    // Non-fatal: seed already completed.
    console.log(`${DIM}seed: complete (could not import DEMO_USER_ID)${RESET}`);
  }
}

main().catch((err) => {
  console.error(`${RED}seed: failed${RESET}`);
  console.error(err);
  process.exit(1);
});
