import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildInputValidator,
  interpolate,
  loadPrompt,
  parseFrontmatter,
  splitIntoBlocks,
} from '../src/loader.js';
import type { PromptInputSpec } from '../src/types.js';

describe('parseFrontmatter', () => {
  it('accepts a valid frontmatter and renames keys to camelCase', () => {
    const fm = parseFrontmatter(
      {
        version: 1,
        model: 'claude-haiku-4-5-20251001',
        cache_breakpoints: ['persona'],
        inputs: [{ name: 'x', type: 'string' }],
        description: 'hi',
        output_schema: 'Out',
      },
      'inline',
    );
    expect(fm.version).toBe(1);
    expect(fm.cacheBreakpoints).toEqual(['persona']);
    expect(fm.outputSchema).toBe('Out');
    expect(fm.inputs[0]?.name).toBe('x');
  });

  it('rejects unknown models', () => {
    expect(() =>
      parseFrontmatter({ version: 1, model: 'gpt-5', cache_breakpoints: [], inputs: [] }, 'x'),
    ).toThrow(/Invalid prompt frontmatter/);
  });

  it('rejects non-positive versions', () => {
    expect(() =>
      parseFrontmatter(
        { version: 0, model: 'claude-opus-4-7', cache_breakpoints: [], inputs: [] },
        'x',
      ),
    ).toThrow(/Invalid prompt frontmatter/);
  });
});

describe('buildInputValidator', () => {
  const specs: PromptInputSpec[] = [
    { name: 'handle', type: 'string' },
    { name: 'goals', type: 'list' },
    { name: 'note', type: 'string', optional: true },
  ];

  it('passes well-formed inputs', () => {
    const v = buildInputValidator(specs);
    const out = v.safeParse({ handle: 'ippo', goals: [1, 2] });
    expect(out.success).toBe(true);
  });

  it('rejects wrong types', () => {
    const v = buildInputValidator(specs);
    const out = v.safeParse({ handle: 123, goals: [] });
    expect(out.success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    const v = buildInputValidator(specs);
    const out = v.safeParse({ handle: 'ippo', goals: [], extra: 'oops' });
    expect(out.success).toBe(false);
  });

  it('treats `optional: true` as allowed missing', () => {
    const v = buildInputValidator(specs);
    const out = v.safeParse({ handle: 'ippo', goals: [] });
    expect(out.success).toBe(true);
  });
});

describe('interpolate', () => {
  const declared: PromptInputSpec[] = [
    { name: 'handle', type: 'string' },
    { name: 'goals', type: 'list' },
  ];

  it('substitutes declared variables', () => {
    const out = interpolate('Hello {{handle}}', { handle: 'ippo', goals: [] }, declared, 'x');
    expect(out).toBe('Hello ippo');
  });

  it('renders lists as bullet markdown', () => {
    const out = interpolate('{{goals}}', { handle: 'i', goals: ['a', 'b'] }, declared, 'x');
    expect(out).toBe('- a\n- b');
  });

  it('throws on undeclared variables', () => {
    expect(() => interpolate('Hi {{unknown}}', { handle: 'i', goals: [] }, declared, 'x')).toThrow(
      /undeclared input/,
    );
  });

  it('renders missing optional as empty string', () => {
    const out = interpolate(
      'before|{{handle}}|after',
      { handle: undefined, goals: [] },
      declared,
      'x',
    );
    expect(out).toBe('before||after');
  });
});

describe('splitIntoBlocks', () => {
  it('returns a single head block when no markers exist', () => {
    const blocks = splitIntoBlocks('just text', []);
    expect(blocks).toEqual([{ name: 'head', text: 'just text', cache: false }]);
  });

  it('splits on cache markers and marks declared breakpoints as cacheable', () => {
    const body =
      'intro paragraph\n\n{{#cache:persona}}\nbig persona text\n\n{{#cache:profile}}\nuser stuff';
    const blocks = splitIntoBlocks(body, ['persona']);
    expect(blocks.map((b) => b.name)).toEqual(['head', 'persona', 'profile']);
    expect(blocks.find((b) => b.name === 'persona')?.cache).toBe(true);
    expect(blocks.find((b) => b.name === 'profile')?.cache).toBe(false);
  });

  it('drops an empty head block when a marker is at the top', () => {
    const blocks = splitIntoBlocks('{{#cache:a}}\nbody', ['a']);
    expect(blocks.map((b) => b.name)).toEqual(['a']);
  });

  it('errors when a declared breakpoint has no marker', () => {
    expect(() => splitIntoBlocks('no markers here', ['persona'])).toThrow(
      /declared in frontmatter but no/,
    );
  });
});

describe('loadPrompt (integration, real prompt files)', () => {
  it('loads and validates the coach/persona.v1 prompt', () => {
    const def = loadPrompt({ category: 'coach', name: 'persona', version: 1 });
    expect(def.id).toBe('coach/persona@1');
    expect(def.model).toBe('claude-haiku-4-5-20251001');
    expect(def.cacheBreakpoints).toContain('persona');
    expect(def.cacheBreakpoints).toContain('principles');
    expect(def.cacheBreakpoints).toContain('examples');
    expect(def.system.length).toBeGreaterThan(2000);
  });

  it('loads coach/daily-checkin.v1 with valid inputs', () => {
    const def = loadPrompt({
      category: 'coach',
      name: 'daily-checkin',
      version: 1,
      inputs: {
        user_handle: 'ippo',
        local_date: '2026-06-14',
        active_goals: [],
        rating_snapshot: { stamina: 800, expertise: 800 },
        recent_training_log: [],
        last_submitted_proof: {},
        open_tasks: [],
      },
    });
    expect(def.system).toContain('ippo');
    expect(def.system).toContain('2026-06-14');
  });

  it('rejects bad inputs for daily-checkin', () => {
    expect(() =>
      loadPrompt({
        category: 'coach',
        name: 'daily-checkin',
        version: 1,
        inputs: {
          user_handle: 123 as unknown as string,
          local_date: '2026-06-14',
          active_goals: [],
          rating_snapshot: {},
          recent_training_log: [],
          open_tasks: [],
        },
      }),
    ).toThrow(/failed validation/);
  });

  it('loads all six v1 prompts without throwing', () => {
    const cases: Array<{ category: string; name: string; inputs: Record<string, unknown> }> = [
      { category: 'coach', name: 'persona', inputs: {} },
      {
        category: 'coach',
        name: 'daily-checkin',
        inputs: {
          user_handle: 'ippo',
          local_date: '2026-06-14',
          active_goals: [],
          rating_snapshot: {},
          recent_training_log: [],
          last_submitted_proof: {},
          open_tasks: [],
        },
      },
      {
        category: 'coach',
        name: 'chat-system',
        inputs: {
          user_handle: 'ippo',
          active_goals: [],
          current_milestone: {},
          recent_training_log: [],
          rating_snapshot: {},
        },
      },
      {
        category: 'roadmap',
        name: 'generate',
        inputs: {
          user_handle: 'ippo',
          goal_title: 'Ship a thing',
          goal_motivation: 'because',
          horizon: '1m',
          target_date: '2026-07-14',
          rating_snapshot: {},
          domain_hint: 'frontend',
          prior_goals: [],
        },
      },
      {
        category: 'roadmap',
        name: 'recalibrate',
        inputs: {
          user_handle: 'ippo',
          goal_title: 'Ship a thing',
          current_roadmap: { milestones: [] },
          week_summary: {},
          rating_snapshot: {},
          rating_history_4w: [],
          today_date: '2026-06-14',
        },
      },
      {
        category: 'proof',
        name: 'grade',
        inputs: {
          task_title: 'Wire up Next.js scaffold',
          task_type: 'jab',
          milestone_title: 'Round 1',
          milestone_deliverable: { kind: 'repo', description: 'a repo' },
          proof_kind: 'repo',
          proof_payload: { readme: 'hi' },
          user_rating: { stamina: 800, expertise: 800 },
        },
      },
    ];
    for (const c of cases) {
      const def = loadPrompt({ ...c, version: 1 });
      expect(def.system.length).toBeGreaterThan(100);
    }
  });
});

describe('loadPrompt (custom rootDir, edge cases)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'prompts-test-'));
    mkdirSync(join(dir, 'demo'), { recursive: true });
    writeFileSync(
      join(dir, 'demo', 'hello.v1.md'),
      `---
version: 1
model: claude-haiku-4-5-20251001
cache_breakpoints: []
inputs:
  - { name: who, type: string }
---
Hello {{who}}.
`,
    );
    writeFileSync(
      join(dir, 'demo', 'bad-version.v2.md'),
      `---
version: 1
model: claude-haiku-4-5-20251001
cache_breakpoints: []
inputs: []
---
mismatch
`,
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads from a custom rootDir', () => {
    const def = loadPrompt({
      category: 'demo',
      name: 'hello',
      version: 1,
      inputs: { who: 'world' },
      rootDir: dir,
    });
    expect(def.system).toBe('Hello world.');
  });

  it('errors when the filename version disagrees with frontmatter version', () => {
    expect(() =>
      loadPrompt({ category: 'demo', name: 'bad-version', version: 2, rootDir: dir }),
    ).toThrow(/declares version 1 but was loaded as v2/);
  });

  it('errors with a helpful message when the file is missing', () => {
    expect(() => loadPrompt({ category: 'demo', name: 'nope', version: 1, rootDir: dir })).toThrow(
      /Could not read prompt file/,
    );
  });
});
