# Prompt eval suite

This directory holds eval cases for every prompt under `packages/prompts/`.
The CI gate in `arch/10-repo-layout.md` runs these whenever a prompt file
changes and blocks merge on regression beyond the configured threshold.

## Layout

```
evals/
├── README.md                      this file
├── coach-daily/                   cases for coach/daily-checkin.v1
│   └── smoke.json
├── coach-chat/                    cases for coach/chat-system.v1
├── coach-persona/                 voice-only smoke tests
├── roadmap-generate/              cases for roadmap/generate.v1
├── roadmap-recalibrate/           cases for roadmap/recalibrate.v1
└── proof-grade/                   cases for proof/grade.v1
```

One subdirectory per prompt. One `.json` file per case. The runner
(`src/eval-runner.ts`) discovers cases recursively, so deeper grouping
is allowed if a single prompt grows enough cases to warrant it (e.g.
`proof-grade/repo-good/`, `proof-grade/repo-bad/`).

## Case file shape

```jsonc
{
  "id": "smoke-new-user",                  // unique, kebab-case
  "prompt": {
    "category": "coach",                   // matches folder under prompts/
    "name": "daily-checkin",               // matches file basename
    "version": 1                           // matches .vN.md
  },
  "inputs": {                              // validated against prompt frontmatter
    "user_handle": "ippo",
    "local_date": "2026-06-14",
    "active_goals": [],
    "rating_snapshot": { "stamina": 800, "expertise": 800 },
    "recent_training_log": [],
    "open_tasks": []
  },
  "expect": {                              // rubric: any failure = case fails
    "contains": ["primaryTask"],           // substrings that must appear (case-insensitive)
    "notContains": ["Great question"],     // substrings that must NOT appear
    "hasKeys": ["primaryTask", "coachLine"],// for structured-output prompts
    "notes": "free-form, surfaced in the report"
  }
}
```

All fields except `id` and `prompt` have sensible defaults; you can
write a case with only `id`, `prompt`, `inputs`, and an empty `expect`
as a parseability check.

## Running

```bash
pnpm --filter @notomorrow/prompts eval
```

The runner needs an LLM caller injected. The default entrypoint is a
stub that returns the rendered prompt back as a string — useful for
"does this prompt parse and validate?" checks. The Coach Service ships
a richer runner that calls Claude through the Anthropic SDK; it lives
in `apps/coach/evals/` and imports from this package.

## Authoring guidelines

- Start every prompt's directory with a `smoke.json` (trivial inputs,
  permissive expectations) so the parser is always exercised.
- Add a "happy path" case that mirrors the most common production
  input shape.
- Add at least one "edge" case per prompt: empty input list, missing
  optional field, hostile or grandiose user message, etc.
- Keep inputs realistic. The eval suite is also our regression bench
  for prompt-induced cost and latency, so synthetic inputs that are
  10x larger than production will mislead.
- When a production issue surfaces, add a case that would have caught
  it BEFORE fixing the prompt. Lock the regression in.

## What the runner scores

The default scorer is intentionally crude (substring match + key
presence). It catches: "the model stopped emitting JSON," "the output
sycophant-leaks back in," "a required field disappeared from the
schema." It does NOT score taste. Taste regressions are caught by
human review of the PR diff and by the production telemetry the Coach
Service emits.

If we need richer scoring later (LLM-as-judge, embedding similarity to
a gold answer), it goes in `apps/coach/evals/` so this package stays
zero-dep.
