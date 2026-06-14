import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverCases, loadCase, runCase, runCases, scoreOutput } from '../src/eval-runner.js';

const EVAL_ROOT = resolve(import.meta.dirname, '..', 'evals');

describe('scoreOutput', () => {
  it('passes when no expectations are set', () => {
    expect(scoreOutput('anything', {})).toEqual([]);
  });

  it('flags missing required substrings (case-insensitive)', () => {
    const failures = scoreOutput('hello world', { contains: ['FOO', 'world'] });
    expect(failures).toEqual(['expected output to contain "FOO"']);
  });

  it('flags forbidden substrings', () => {
    const failures = scoreOutput('Great question, friend!', {
      notContains: ['great question'],
    });
    expect(failures.length).toBe(1);
    expect(failures[0]).toMatch(/NOT to contain/);
  });

  it('checks structured-output keys', () => {
    const failures = scoreOutput({ primaryTask: {} }, { hasKeys: ['primaryTask', 'coachLine'] });
    expect(failures).toEqual(['expected output object to include key "coachLine"']);
  });

  it('rejects plain text when hasKeys is set', () => {
    const failures = scoreOutput('just text', { hasKeys: ['x'] });
    expect(failures[0]).toMatch(/structured-object output/);
  });
});

describe('loadCase / discoverCases', () => {
  it('discovers the bundled smoke case', () => {
    const cases = discoverCases(EVAL_ROOT);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.some((p) => p.endsWith('coach-daily/smoke.json'))).toBe(true);
  });

  it('parses the bundled smoke case', () => {
    const path = resolve(EVAL_ROOT, 'coach-daily', 'smoke.json');
    const c = loadCase(path);
    expect(c.id).toBe('smoke-new-user-empty-log');
    expect(c.prompt.name).toBe('daily-checkin');
  });
});

describe('runCase / runCases (with stub LLM)', () => {
  it('runs a single case end-to-end and reports pass/fail', async () => {
    const path = resolve(EVAL_ROOT, 'coach-daily', 'smoke.json');
    const c = loadCase(path);

    // Stub LLM: echoes back the system text so the expectation rubric can
    // verify the rendered prompt mentions the right tokens.
    const result = await runCase(c, {
      call: async (def) => def.system,
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('runs every case under the eval root', async () => {
    const results = await runCases(EVAL_ROOT, {
      call: async (def) => def.system,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.case.id).toBeTruthy();
    }
  });

  it('reports failures when the LLM output misses an expectation', async () => {
    const path = resolve(EVAL_ROOT, 'coach-daily', 'smoke.json');
    const c = loadCase(path);
    const result = await runCase(c, {
      call: async () => 'totally unrelated output',
    });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
