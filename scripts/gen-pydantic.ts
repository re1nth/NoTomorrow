/**
 * gen-pydantic — regenerate `apps/coach/src/coach/schemas/codegen_full.py`
 * from the domain JSON Schema.
 *
 * Steps:
 *   1. Ensure `packages/domain/dist/json-schema.json` exists; if not, build the
 *      domain package (`pnpm --filter @notomorrow/domain build`).
 *   2. Invoke the Python script in `apps/coach/scripts/gen_pydantic.py` via
 *      `uv run`, forwarding any extra CLI args.
 *
 * Usage:
 *   pnpm gen:pydantic
 *   pnpm gen:pydantic -- --group entities
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    console.log(`${DIM}$ ${cmd} ${args.join(' ')}${cwd ? ` (cwd=${cwd})` : ''}${RESET}`);
    const child = spawn(cmd, args, { stdio: 'inherit', env: process.env, cwd });
    child.on('error', rejectP);
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..');
  const jsonSchemaPath = resolve(repoRoot, 'packages/domain/dist/json-schema.json');
  const coachDir = resolve(repoRoot, 'apps/coach');

  if (!existsSync(jsonSchemaPath)) {
    console.log(
      `${YELLOW}gen-pydantic:${RESET} ${jsonSchemaPath} missing — building @notomorrow/domain…`,
    );
    await run('pnpm', ['--filter', '@notomorrow/domain', 'build']);
    if (!existsSync(jsonSchemaPath)) {
      console.error(
        `${RED}gen-pydantic:${RESET} build finished but ${jsonSchemaPath} still missing`,
      );
      process.exit(1);
    }
  }

  // Forward extra CLI args after `--` so callers can pass --group / --output etc.
  const extra = process.argv.slice(2);
  await run('uv', ['run', 'python', 'scripts/gen_pydantic.py', ...extra], coachDir);
  console.log(`${GREEN}gen-pydantic: done${RESET}`);
}

main().catch((err) => {
  console.error(`${RED}gen-pydantic: failed${RESET}`);
  console.error(err);
  process.exit(1);
});
