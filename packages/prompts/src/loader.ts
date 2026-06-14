import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import type {
  InputValidator,
  LoadPromptArgs,
  PromptBlock,
  PromptDef,
  PromptFrontmatter,
  PromptFrontmatterRaw,
  PromptInputSpec,
  PromptModel,
} from './types.js';

const SUPPORTED_MODELS: readonly PromptModel[] = [
  'claude-haiku-4-5-20251001',
  'claude-opus-4-7',
  'claude-sonnet-4-5',
];

/**
 * Default prompt root. Resolves relative to this source file so the loader
 * works whether the package is consumed via the workspace symlink or copied
 * into a deployed bundle.
 */
const DEFAULT_PROMPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prompts');

const inputSpecSchema: z.ZodType<PromptInputSpec> = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'list', 'object']),
  description: z.string().optional(),
  optional: z.boolean().optional(),
});

const frontmatterSchema = z.object({
  version: z.number().int().positive(),
  model: z.enum(SUPPORTED_MODELS as unknown as [PromptModel, ...PromptModel[]]),
  cache_breakpoints: z.array(z.string().min(1)).default([]),
  inputs: z.array(inputSpecSchema).default([]),
  description: z.string().optional(),
  output_schema: z.string().optional(),
});

/**
 * Convert raw frontmatter (string-keyed YAML object) into a validated,
 * normalized `PromptFrontmatter`. Throws a descriptive error on mismatch.
 */
export function parseFrontmatter(
  raw: PromptFrontmatterRaw | Record<string, unknown>,
  source: string,
): PromptFrontmatter {
  const parsed = frontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid prompt frontmatter in ${source}:\n${issues}\n` +
        `Required keys: version (number), model (one of ${SUPPORTED_MODELS.join(', ')}).`,
    );
  }
  const { output_schema, cache_breakpoints, ...rest } = parsed.data;
  return {
    ...rest,
    cacheBreakpoints: cache_breakpoints,
    outputSchema: output_schema,
  };
}

/**
 * Build a Zod object validator from the declared inputs. Required-by-default
 * unless `optional: true` is set on the spec.
 */
export function buildInputValidator(inputs: PromptInputSpec[]): InputValidator {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const spec of inputs) {
    let leaf: z.ZodTypeAny;
    switch (spec.type) {
      case 'string':
        leaf = z.string();
        break;
      case 'number':
        leaf = z.number();
        break;
      case 'boolean':
        leaf = z.boolean();
        break;
      case 'list':
        leaf = z.array(z.unknown());
        break;
      case 'object':
        leaf = z.record(z.unknown());
        break;
      default: {
        // Exhaustiveness guard. Should never fire because frontmatterSchema
        // already restricts the enum.
        const _exhaustive: never = spec.type;
        throw new Error(`Unknown input type: ${String(_exhaustive)}`);
      }
    }
    shape[spec.name] = spec.optional ? leaf.optional() : leaf;
  }
  return z.object(shape).strict();
}

/**
 * Render an input value as a string suitable for interpolation. Lists and
 * objects get pretty-printed; primitives use `String(...)`. Null/undefined
 * become the empty string so optional inputs don't dump "undefined" into the
 * prompt.
 */
function renderInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? `- ${item}` : `- ${JSON.stringify(item)}`))
      .join('\n');
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Substitute `{{name}}` tokens in the body with rendered input values.
 * Unknown tokens trigger an error so prompts can't silently drift from their
 * declared inputs.
 */
export function interpolate(
  body: string,
  inputs: Record<string, unknown>,
  declared: PromptInputSpec[],
  source: string,
): string {
  const known = new Set(declared.map((i) => i.name));
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    if (!known.has(name)) {
      throw new Error(
        `Prompt ${source} references undeclared input "{{${name}}}". Add it to the frontmatter \`inputs:\` list.`,
      );
    }
    return renderInput(inputs[name]);
  });
}

const CACHE_MARKER_RE = /^\s*\{\{#cache:([a-zA-Z_][a-zA-Z0-9_-]*)\}\}\s*$/gm;

/**
 * Split a prompt body on `{{#cache:name}}` markers. The text before the first
 * marker is the implicit `head` block; each marker introduces a new named
 * block. Only blocks whose name appears in `cacheBreakpoints` are marked
 * cacheable (so a marker can exist for structural reasons without forcing a
 * cache write).
 */
export function splitIntoBlocks(body: string, cacheBreakpoints: string[]): PromptBlock[] {
  const cacheSet = new Set(cacheBreakpoints);
  const blocks: PromptBlock[] = [];
  const markers: Array<{ name: string; start: number; end: number }> = [];

  // Reset regex state — `lastIndex` is shared across calls for /g regexes.
  CACHE_MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((match = CACHE_MARKER_RE.exec(body)) !== null) {
    markers.push({
      name: match[1] as string,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  if (markers.length === 0) {
    // If breakpoints were declared, every one of them must resolve to a real
    // block; with no markers the only block is `head`, so anything else fails.
    for (const required of cacheBreakpoints) {
      if (required !== 'head') {
        throw new Error(
          `Cache breakpoint "${required}" declared in frontmatter but no ` +
            `\`{{#cache:${required}}}\` marker found in the prompt body.`,
        );
      }
    }
    return [{ name: 'head', text: body.trim(), cache: cacheSet.has('head') }];
  }

  const headText = body.slice(0, markers[0]!.start).trim();
  if (headText.length > 0) {
    blocks.push({ name: 'head', text: headText, cache: cacheSet.has('head') });
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const nextStart = i + 1 < markers.length ? markers[i + 1]!.start : body.length;
    const text = body.slice(marker.end, nextStart).trim();
    if (text.length === 0) continue;
    blocks.push({
      name: marker.name,
      text,
      cache: cacheSet.has(marker.name),
    });
  }

  // If the author declared a breakpoint but never used the marker, surface it
  // as a hard error — silent no-ops here would mean a broken cache strategy in
  // production, and we want that to fail loud during development.
  const seen = new Set(blocks.map((b) => b.name));
  for (const required of cacheBreakpoints) {
    if (!seen.has(required)) {
      throw new Error(
        `Cache breakpoint "${required}" declared in frontmatter but no ` +
          `\`{{#cache:${required}}}\` marker found in the prompt body.`,
      );
    }
  }

  return blocks;
}

/**
 * Load a prompt by `(category, name, version)`. Reads the markdown file from
 * disk, parses frontmatter, validates inputs against the declared Zod schema,
 * interpolates input values, splits the body on cache-breakpoint markers, and
 * returns a `PromptDef` the Anthropic SDK can consume.
 */
export function loadPrompt(args: LoadPromptArgs): PromptDef {
  const { category, name, version, inputs = {}, rootDir = DEFAULT_PROMPT_ROOT } = args;

  const file = resolve(rootDir, category, `${name}.v${version}.md`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read prompt file at ${file}: ${cause}`);
  }

  const parsed = matter(raw);
  const frontmatter = parseFrontmatter(parsed.data as PromptFrontmatterRaw, file);

  if (frontmatter.version !== version) {
    throw new Error(
      `Prompt ${file} declares version ${frontmatter.version} but was loaded ` +
        `as v${version}. Rename the file or fix the frontmatter.`,
    );
  }

  const validator = buildInputValidator(frontmatter.inputs);
  const validation = validator.safeParse(inputs);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Inputs for prompt ${category}/${name}@${version} failed validation:\n${issues}`,
    );
  }

  const validatedInputs = validation.data as Record<string, unknown>;
  const rendered = interpolate(parsed.content, validatedInputs, frontmatter.inputs, file);
  const blocks = splitIntoBlocks(rendered, frontmatter.cacheBreakpoints);
  const system = blocks.map((b) => b.text).join('\n\n');

  return {
    id: `${category}/${name}@${version}`,
    category,
    name,
    version,
    model: frontmatter.model,
    system,
    blocks,
    cacheBreakpoints: blocks.filter((b) => b.cache).map((b) => b.name),
    messages: [],
    inputs: validatedInputs,
    frontmatter,
  };
}

/** Exposed default root so consumers (e.g. the web debug UI) can list files. */
export const PROMPT_ROOT = DEFAULT_PROMPT_ROOT;
