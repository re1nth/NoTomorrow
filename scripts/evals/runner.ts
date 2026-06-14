/**
 * evals/runner — repo-level eval orchestrator.
 *
 * Runs both eval halves and prints a unified summary:
 *
 *   TS half  — `@notomorrow/prompts/eval-runner` invoked in-process with a
 *              deterministic mock `LlmCaller`. Mirrors what
 *              `apps/coach/evals/runner.py --mock` does on the Python side, so
 *              both halves are reproducible with zero network calls.
 *   Py half  — `uv run python -m evals.runner --mock` in `apps/coach`.
 *
 * Flags:
 *   --quick                 Only run the smoke case for `coach/daily-checkin`.
 *   --prompt <cat>/<name>   Filter both halves to one prompt id.
 *   --ts-only               Skip the Python half.
 *   --py-only               Skip the TS half.
 *
 * Exit code:
 *   0 if every executed half passed, non-zero otherwise. We always run both
 *   halves to completion (no early bail) so CI gets the full picture.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface CliArgs {
  quick: boolean;
  prompt: string | null;
  tsOnly: boolean;
  pyOnly: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { quick: false, prompt: null, tsOnly: false, pyOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') args.quick = true;
    else if (a === '--ts-only') args.tsOnly = true;
    else if (a === '--py-only') args.pyOnly = true;
    else if (a === '--prompt') {
      const next = argv[++i];
      if (!next) {
        console.error(`${RED}evals:${RESET} --prompt requires a value like coach/daily-checkin`);
        process.exit(2);
      }
      args.prompt = next;
    } else if (a?.startsWith('--prompt=')) {
      args.prompt = a.slice('--prompt='.length);
    }
  }
  if (args.tsOnly && args.pyOnly) {
    console.error(`${RED}evals:${RESET} --ts-only and --py-only are mutually exclusive`);
    process.exit(2);
  }
  // --quick is shorthand for filtering to the canonical smoke prompt.
  if (args.quick && !args.prompt) args.prompt = 'coach/daily-checkin';
  return args;
}

interface HalfResult {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: boolean;
  ok: boolean;
  error?: string;
}

async function runTsHalf(args: CliArgs): Promise<HalfResult> {
  const result: HalfResult = {
    name: 'ts',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: false,
    ok: false,
  };

  // Dynamic-import so a missing workspace install yields a clean error, not a
  // top-level resolution crash. We resolve the package via its on-disk path in
  // the monorepo because `scripts/` intentionally has no `package.json` and so
  // can't declare `@notomorrow/prompts` as a workspace dep.
  const here = dirname(fileURLToPath(import.meta.url));
  const evalRunnerSrc = pathToFileURL(
    resolve(here, '..', '..', 'packages/prompts/src/eval-runner.ts'),
  ).href;
  let mod: typeof import('@notomorrow/prompts/eval-runner');
  try {
    mod = (await import(evalRunnerSrc)) as typeof import('@notomorrow/prompts/eval-runner');
  } catch (err) {
    result.error = `failed to import @notomorrow/prompts eval-runner: ${(err as Error).message}`;
    return result;
  }

  // Mock LlmCaller: returns either parsed JSON for prompts whose smoke case
  // exercises hasKeys, or a plain string echo. Deterministic — zero network.
  type PromptDef = Parameters<import('@notomorrow/prompts').LlmCaller>[0];
  const mockCall = async (def: PromptDef): Promise<string | Record<string, unknown>> => {
    if (def.category === 'coach' && def.name === 'daily-checkin') {
      return JSON.stringify({
        primaryTask: {
          title: 'Wire up the Next.js scaffold',
          type: 'jab',
          estMinutes: 30,
          rationale: 'First punch lands proof-of-life this week.',
        },
        stretchTask: null,
        coachLine: "You're here. Good. Show me the first commit by tonight.",
      });
    }
    // Generic echo — surface the rendered system text so substring rubrics work.
    return def.system;
  };

  const root = mod.DEFAULT_EVAL_ROOT;
  const allFiles = mod.discoverCases(root);

  // Filter by prompt id when requested. We mirror the Python half's filter
  // semantics: match `${category}/${name}`.
  const wanted = args.prompt;
  const files = wanted
    ? allFiles.filter((f) => {
        try {
          const c = mod.loadCase(f);
          return `${c.prompt.category}/${c.prompt.name}` === wanted;
        } catch {
          return false;
        }
      })
    : allFiles;

  if (files.length === 0) {
    result.error = wanted ? `no TS cases matched ${wanted}` : 'no TS cases discovered';
    return result;
  }

  for (const file of files) {
    let caseDef: ReturnType<typeof mod.loadCase>;
    try {
      caseDef = mod.loadCase(file);
    } catch (err) {
      result.total += 1;
      result.failed += 1;
      console.error(`  ${RED}FAIL${RESET} (parse) ${file}: ${(err as Error).message}`);
      continue;
    }
    try {
      const r = await mod.runCase(caseDef, { call: mockCall });
      result.total += 1;
      if (r.passed) {
        result.passed += 1;
        console.log(`  ${GREEN}PASS${RESET} ${caseDef.id} ${DIM}(${r.latencyMs}ms)${RESET}`);
      } else {
        result.failed += 1;
        console.log(`  ${RED}FAIL${RESET} ${caseDef.id}`);
        for (const f of r.failures) console.log(`    ${DIM}- ${f}${RESET}`);
      }
    } catch (err) {
      result.total += 1;
      result.failed += 1;
      console.error(`  ${RED}FAIL${RESET} (run) ${caseDef.id}: ${(err as Error).message}`);
    }
  }

  result.ok = result.failed === 0;
  return result;
}

function runPyHalf(args: CliArgs, coachDir: string): Promise<HalfResult> {
  return new Promise((resolveP) => {
    const result: HalfResult = {
      name: 'py',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: false,
      ok: false,
    };

    const cliArgs = ['run', 'python', '-m', 'evals.runner', '--mock'];
    if (args.prompt) cliArgs.push('--prompt', args.prompt);

    console.log(`${DIM}$ uv ${cliArgs.join(' ')} (cwd=${coachDir})${RESET}`);
    const child = spawn('uv', cliArgs, {
      cwd: coachDir,
      env: { ...process.env, EVAL_MOCK: '1' },
      stdio: ['inherit', 'pipe', 'inherit'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });

    child.on('error', (err) => {
      result.error = `failed to spawn uv: ${err.message}`;
      resolveP(result);
    });

    child.on('exit', (code) => {
      // Try to parse the JSON report the python runner prints at the end.
      const lastBrace = stdout.lastIndexOf('{');
      if (lastBrace >= 0) {
        try {
          const parsed = JSON.parse(stdout.slice(lastBrace)) as {
            total?: number;
            passed?: number;
            failed?: number;
          };
          if (typeof parsed.total === 'number') result.total = parsed.total;
          if (typeof parsed.passed === 'number') result.passed = parsed.passed;
          if (typeof parsed.failed === 'number') result.failed = parsed.failed;
        } catch {
          // ignore; we still have the exit code as the authoritative signal.
        }
      }
      if (code === 0) {
        result.ok = true;
      } else {
        result.ok = false;
        if (!result.error) result.error = `python runner exited with code ${code}`;
      }
      resolveP(result);
    });
  });
}

function printSummary(halves: HalfResult[]): boolean {
  console.log(`\n${BOLD}eval summary${RESET}`);
  let allOk = true;
  for (const h of halves) {
    if (h.skipped) {
      console.log(`  ${DIM}${h.name}: skipped${RESET}`);
      continue;
    }
    const status = h.ok ? `${GREEN}OK${RESET}` : `${RED}FAIL${RESET}`;
    const counts = `${h.passed}/${h.total} passed${h.failed ? `, ${h.failed} failed` : ''}`;
    console.log(`  ${h.name.padEnd(3)} ${status}  ${counts}`);
    if (h.error) console.log(`      ${DIM}${h.error}${RESET}`);
    if (!h.ok) allOk = false;
  }
  return allOk;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..', '..');
  const coachDir = resolve(repoRoot, 'apps/coach');

  const halves: HalfResult[] = [];

  if (!args.pyOnly) {
    console.log(`${BOLD}— TS evals —${RESET}`);
    halves.push(await runTsHalf(args));
  } else {
    halves.push({ name: 'ts', total: 0, passed: 0, failed: 0, skipped: true, ok: true });
  }

  if (!args.tsOnly) {
    console.log(`\n${BOLD}— Python evals —${RESET}`);
    if (!existsSync(coachDir)) {
      halves.push({
        name: 'py',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: false,
        ok: false,
        error: `apps/coach not found at ${coachDir}`,
      });
    } else {
      halves.push(await runPyHalf(args, coachDir));
    }
  } else {
    halves.push({ name: 'py', total: 0, passed: 0, failed: 0, skipped: true, ok: true });
  }

  const allOk = printSummary(halves);
  if (!allOk) {
    console.error(`\n${YELLOW}evals: one or more halves failed${RESET}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}evals: orchestrator crashed${RESET}`);
  console.error(err);
  process.exit(1);
});
