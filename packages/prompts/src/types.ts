import type { ZodTypeAny } from 'zod';

/**
 * Supported LLM models. Kept narrow on purpose — adding a model is an
 * intentional decision because it affects cost and prompt-cache compatibility.
 */
export type PromptModel = 'claude-haiku-4-5-20251001' | 'claude-opus-4-7' | 'claude-sonnet-4-5';

/**
 * One declared input in the prompt's frontmatter.
 * Matched at runtime against the values passed to `loadPrompt`.
 */
export type PromptInputType = 'string' | 'number' | 'boolean' | 'list' | 'object';

export interface PromptInputSpec {
  /** Variable name as referenced in the prompt body, e.g. `{{user_handle}}`. */
  name: string;
  /** Coarse runtime type used to build the Zod validator. */
  type: PromptInputType;
  /** Optional human-readable description, surfaced in the debug UI. */
  description?: string;
  /** If false, the input must be provided. Defaults to true (required). */
  optional?: boolean;
}

/**
 * Frontmatter shape, parsed straight from YAML before validation.
 * The loader normalizes & validates this into a strict `PromptFrontmatter`.
 */
export interface PromptFrontmatterRaw {
  version?: number;
  model?: string;
  cache_breakpoints?: string[];
  inputs?: PromptInputSpec[];
  description?: string;
  output_schema?: string;
}

/**
 * Validated, normalized frontmatter.
 */
export interface PromptFrontmatter {
  version: number;
  model: PromptModel;
  /**
   * Named cache-breakpoint markers. The loader splits the prompt body on
   * `{{#cache:<name>}}` markers and exposes them via `cacheBreakpoints` so the
   * Anthropic SDK caller can attach `cache_control` to the corresponding block.
   */
  cacheBreakpoints: string[];
  inputs: PromptInputSpec[];
  description?: string;
  /** Optional name of a structured-output schema the grader expects back. */
  outputSchema?: string;
}

/**
 * A single block of the prompt body. Blocks are produced by splitting on
 * `{{#cache:<name>}}` markers; everything before the first marker is the
 * implicit `head` block. Each block is one Anthropic content-block candidate.
 */
export interface PromptBlock {
  /** `head` for everything before the first marker, otherwise the marker name. */
  name: string;
  /** Rendered text for this block (with input variables substituted). */
  text: string;
  /** If true, the Anthropic SDK should attach `cache_control` to this block. */
  cache: boolean;
}

/**
 * Result of `loadPrompt`. Designed to be handed almost verbatim to the
 * Anthropic SDK: `system` is the concatenated system text, `messages` is the
 * user-turn list, and `cacheBreakpoints` tells the caller which content blocks
 * to mark as cacheable.
 */
export interface PromptDef {
  /** Fully qualified id, e.g. `coach/persona@1`. */
  id: string;
  /** Category folder (e.g. `coach`, `roadmap`, `proof`). */
  category: string;
  /** Prompt name within the category (e.g. `persona`, `daily-checkin`). */
  name: string;
  /** Version number, mirrors `inputs.version` from frontmatter. */
  version: number;
  /** Anthropic model id the prompt is tuned for. */
  model: PromptModel;
  /** Concatenated system text (all blocks joined). */
  system: string;
  /** Structured blocks: lets callers wire cache_control per block. */
  blocks: PromptBlock[];
  /** Names of blocks the caller should mark as cacheable. */
  cacheBreakpoints: string[];
  /**
   * Initial user-turn messages. v1 always has zero or one user turn; the
   * caller appends conversation history on top.
   */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The validated inputs, echoed back for debugging / logging. */
  inputs: Record<string, unknown>;
  /** Raw frontmatter, in case the caller needs `outputSchema` etc. */
  frontmatter: PromptFrontmatter;
}

export interface LoadPromptArgs {
  category: string;
  name: string;
  version: number;
  /** Values to substitute into the prompt body. Validated against frontmatter. */
  inputs?: Record<string, unknown>;
  /**
   * Override for where to find prompt files. Defaults to the `prompts/`
   * directory shipped inside this package. Useful in tests.
   */
  rootDir?: string;
}

/**
 * Eval case file shape. One case = one input set + expectation rubric.
 */
export interface EvalCase {
  id: string;
  prompt: {
    category: string;
    name: string;
    version: number;
  };
  inputs: Record<string, unknown>;
  expect: {
    /** Substrings that MUST appear in the output (case-insensitive). */
    contains?: string[];
    /** Substrings that MUST NOT appear in the output. */
    notContains?: string[];
    /** JSON-path-style key list the output object must include. */
    hasKeys?: string[];
    /** Free-form notes, surfaced in the report. */
    notes?: string;
  };
}

export interface EvalResult {
  case: EvalCase;
  passed: boolean;
  failures: string[];
  rawOutput: unknown;
  latencyMs: number;
}

/**
 * Loader passed to the eval runner. Sub-agents inject their own caller so this
 * package keeps zero LLM-SDK dependencies.
 */
export type LlmCaller = (def: PromptDef) => Promise<string | Record<string, unknown>>;

/** Frontmatter validators are factored out so tests can reuse them. */
export type FrontmatterValidator = (raw: unknown) => PromptFrontmatter;

/** Zod validator type alias for clarity inside the loader. */
export type InputValidator = ZodTypeAny;
