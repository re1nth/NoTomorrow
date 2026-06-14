# packages/prompts — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 0.** Independent; can start in parallel with `domain` and `ui`.

## Mission

Versioned LLM prompts as markdown files, plus loaders for both TS and Python.
One source of truth so the web debug UI and the Coach Service execute the same
text.

## Scope

**In:**
- Markdown prompt files with frontmatter (`model`, `cache_breakpoints`,
  `inputs`, `version`)
- Initial v1 prompts:
  - `coach/persona.v1.md` — the Kamogawa-coded persona (~5k tokens; cache-hot)
  - `coach/daily-checkin.v1.md` — daily Haiku message
  - `coach/chat-system.v1.md` — system prompt for free-form chat
  - `roadmap/generate.v1.md` — goal → milestones
  - `roadmap/recalibrate.v1.md` — weekly replan
  - `proof/grade.v1.md` — structured-output grader
- TS loader: `loadPrompt({ category, name, version })`
- Eval scaffold (cases live under `evals/`, runner can be empty initially)

**Out:**
- Prompt A/B framework (later)
- In-product prompt editor (later)
- Actual eval cases (track them, but content can grow over time)

## Dependencies (consumes)

None. Loosely references entity names from `packages/domain` in prompt text but
no code dependency.

## Exposes

- File tree at `packages/prompts/{category}/{name}.v{n}.md`
- TS loader: `import { loadPrompt } from '@notomorrow/prompts'`
- Python reads files directly: `from pathlib import Path`

## Frontmatter convention

```yaml
---
version: 1
model: claude-haiku-4-5-20251001 | claude-opus-4-7
cache_breakpoints: [system, user_profile]
inputs:
  - name: user_handle
    type: string
  - name: active_goals
    type: list
---
```

## Build steps (ordered)

1. `package.json` with deps: `gray-matter`, `zod`
2. `src/loader.ts` — reads file, parses frontmatter, validates inputs against
   Zod schema, returns `{ system, messages, model, cacheBreakpoints }`
3. Write `coach/persona.v1.md` first (it's the heaviest; sets the voice for
   everything else)
4. Write `coach/daily-checkin.v1.md` — references persona via include marker
5. Write remaining prompts in priority order
6. `evals/README.md` + an empty `evals/coach-daily/` folder so Coach team can
   add cases
7. `eval-runner.ts` — reads case files, calls Claude, scores, emits report

## Acceptance criteria

- [ ] All six v1 prompts written and parseable by the loader
- [ ] Loader validates inputs against Zod schema declared in frontmatter
- [ ] Cache breakpoint markers respected (loader returns block boundaries the
      Anthropic SDK can use)
- [ ] Eval runner can execute a single case end-to-end (even with one trivial
      case)
- [ ] `pnpm typecheck` passes

## Verification

```
pnpm --filter @notomorrow/prompts test
pnpm --filter @notomorrow/prompts eval -- --case coach/daily-checkin/smoke
```

## Deferred / out of scope

- Prompt diffing UI
- Multi-model fan-out
- Cost reporting per prompt (CoachService instrumentation handles this)

## Open questions

- Persona length budget: 5k tokens is the working assumption. Decide cap.
- Should prompts include hardcoded examples or pull them from a separate
  `examples/` folder?

## Coordination

- `apps/coach` is the primary consumer at runtime.
- Any change to frontmatter shape or loader return type is a breaking interface
  change.
- Eval suite gates merges that touch any file in this directory (see
  [arch/10-repo-layout.md](../../arch/10-repo-layout.md) CI gates).
