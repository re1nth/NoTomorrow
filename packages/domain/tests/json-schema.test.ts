import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import * as Entities from '../src/entities/index.js';

/**
 * The JSON Schema bundle on disk is built by scripts/build-json-schema.ts.
 * Here we sanity-check the underlying transform on a representative entity
 * to ensure (a) the export contract works and (b) it's deterministic
 * between calls — same input, same output bytes.
 */
describe('zod -> JSON Schema bridge', () => {
  it('produces identical output on repeated runs (Goal)', () => {
    const goal = Entities.Goal as unknown as ZodTypeAny;
    const a = JSON.stringify(zodToJsonSchema(goal, { name: 'Goal', target: 'jsonSchema7' }));
    const b = JSON.stringify(zodToJsonSchema(goal, { name: 'Goal', target: 'jsonSchema7' }));
    expect(a).toBe(b);
  });

  it('emits an object schema with the expected required fields (Goal)', () => {
    const goal = Entities.Goal as unknown as ZodTypeAny;
    const schema = zodToJsonSchema(goal, { name: 'Goal', target: 'jsonSchema7' }) as Record<
      string,
      unknown
    >;
    // zod-to-json-schema nests the actual schema under `definitions[name]` when `name` is set.
    const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
    expect(definitions).toBeDefined();
    const inner = definitions?.Goal;
    expect(inner).toBeDefined();
    expect(inner?.type).toBe('object');
    const required = inner?.required as string[];
    for (const field of [
      'id',
      'userId',
      'title',
      'horizon',
      'targetDate',
      'status',
      'createdAt',
    ]) {
      expect(required).toContain(field);
    }
  });
});
