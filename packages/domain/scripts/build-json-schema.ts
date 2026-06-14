/**
 * Builds dist/json-schema.json — a single JSON Schema document containing
 * every Zod schema exported from @notomorrow/domain. Consumed by apps/coach
 * for Pydantic codegen.
 *
 * Output ordering is fully deterministic so CI diffs only when shapes change.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import * as Enums from '../src/enums.js';
import * as Entities from '../src/entities/index.js';
import * as Api from '../src/api/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../dist/json-schema.json');

type Group = { name: string; module: Record<string, unknown> };

const groups: Group[] = [
  { name: 'enums', module: Enums },
  { name: 'entities', module: Entities },
  { name: 'api', module: Api },
];

/** Best-effort Zod-type detector that does not depend on a specific minor. */
function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    typeof (value as { parse?: unknown }).parse === 'function'
  );
}

/** Recursively sort object keys for stable JSON output. */
function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeys(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeys(v);
    }
    return out as T;
  }
  return value;
}

function collect(): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const group of groups) {
    const schemas: Record<string, unknown> = {};
    const sortedExportNames = Object.keys(group.module).sort();
    for (const name of sortedExportNames) {
      const value = group.module[name];
      if (!isZodSchema(value)) continue;
      schemas[name] = zodToJsonSchema(value, {
        name,
        target: 'jsonSchema7',
        $refStrategy: 'none',
      });
    }
    result[group.name] = schemas;
  }
  return result;
}

function main(): void {
  const document = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: '@notomorrow/domain',
    description:
      'Generated JSON Schema bundle for Pydantic codegen in apps/coach. Do not edit by hand.',
    generator: 'packages/domain/scripts/build-json-schema.ts',
    groups: collect(),
  };

  const sorted = sortKeys(document);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  // Trailing newline for POSIX-friendly files; 2-space indent matches biome.json.
  writeFileSync(OUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  const totalSchemas = Object.values(sorted.groups).reduce(
    (sum, g) => sum + Object.keys(g).length,
    0,
  );
  console.log(`[domain] wrote ${OUT_PATH} (${totalSchemas} schemas)`);
}

main();
