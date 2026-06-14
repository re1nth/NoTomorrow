import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { loadPrompt } from './loader.js';
import type { EvalCase, EvalResult, LlmCaller } from './types.js';

const evalCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.object({
    category: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive(),
  }),
  inputs: z.record(z.unknown()).default({}),
  expect: z
    .object({
      contains: z.array(z.string()).optional(),
      notContains: z.array(z.string()).optional(),
      hasKeys: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .default({}),
});

/** Parse and validate an eval case file (JSON). */
export function loadCase(path: string): EvalCase {
  const raw = readFileSync(path, 'utf8');
  const json = JSON.parse(raw) as unknown;
  const parsed = evalCaseSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid eval case ${path}:\n${issues}`);
  }
  return parsed.data as EvalCase;
}

/** Recursively collect every `.json` file under `dir`. */
export function discoverCases(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && extname(entry) === '.json') {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Score a single LLM output against a case's expectation rubric. Returns the
 * list of failure strings (empty list = pass).
 */
export function scoreOutput(
  output: string | Record<string, unknown>,
  expect: EvalCase['expect'],
): string[] {
  const failures: string[] = [];
  const asText = typeof output === 'string' ? output : JSON.stringify(output);
  const lower = asText.toLowerCase();

  for (const needle of expect.contains ?? []) {
    if (!lower.includes(needle.toLowerCase())) {
      failures.push(`expected output to contain "${needle}"`);
    }
  }
  for (const needle of expect.notContains ?? []) {
    if (lower.includes(needle.toLowerCase())) {
      failures.push(`expected output NOT to contain "${needle}"`);
    }
  }
  if (expect.hasKeys && expect.hasKeys.length > 0) {
    if (typeof output !== 'object' || output === null) {
      failures.push('expected structured-object output, got plain text');
    } else {
      for (const key of expect.hasKeys) {
        if (!(key in output)) {
          failures.push(`expected output object to include key "${key}"`);
        }
      }
    }
  }
  return failures;
}

export interface RunCasesOptions {
  /** Function that calls the underlying LLM. Injected so this layer has no SDK dep. */
  call: LlmCaller;
  /**
   * Optional override for the prompt root directory, forwarded to `loadPrompt`.
   * Default: the package's bundled `prompts/` directory.
   */
  promptRoot?: string;
  /** Optional logger; defaults to silent. */
  log?: (line: string) => void;
}

/** Execute a single case end-to-end and return a structured result. */
export async function runCase(caseDef: EvalCase, options: RunCasesOptions): Promise<EvalResult> {
  const { call, promptRoot, log = () => {} } = options;
  const def = loadPrompt({
    category: caseDef.prompt.category,
    name: caseDef.prompt.name,
    version: caseDef.prompt.version,
    inputs: caseDef.inputs,
    rootDir: promptRoot,
  });
  log(`[eval] running ${caseDef.id} on ${def.id}`);
  const start = Date.now();
  const output = await call(def);
  const latencyMs = Date.now() - start;
  const failures = scoreOutput(output, caseDef.expect);
  const passed = failures.length === 0;
  log(`[eval] ${passed ? 'PASS' : 'FAIL'} ${caseDef.id} (${latencyMs}ms)`);
  return { case: caseDef, passed, failures, rawOutput: output, latencyMs };
}

/**
 * Run every case under `dir` and return the result list. Failures do not throw
 * — the caller decides what to do (CI usually wants a non-zero exit code if
 * any case fails).
 */
export async function runCases(dir: string, options: RunCasesOptions): Promise<EvalResult[]> {
  const files = discoverCases(dir);
  const results: EvalResult[] = [];
  for (const file of files) {
    const caseDef = loadCase(file);
    results.push(await runCase(caseDef, options));
  }
  return results;
}

/**
 * Tiny helper for the most common case: run everything under
 * `packages/prompts/evals/`. Re-exported via the barrel for convenience.
 */
export const DEFAULT_EVAL_ROOT = resolve(
  // eval-runner.ts lives in src/, so up one to the package root.
  new URL('../evals', import.meta.url).pathname,
);
