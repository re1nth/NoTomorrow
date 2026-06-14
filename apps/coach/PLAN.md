# apps/coach — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 1.** Depends on `domain`, `prompts`, `db` interface stubs.

## Mission

Python FastAPI service that owns all LLM orchestration: roadmap generation,
proof grading, daily coach messages, free-form chat. See
[arch/06-coach-loop.md](../../arch/06-coach-loop.md) for the loops.

## Scope

**In:**
- FastAPI app with the endpoints below
- Anthropic SDK wrapper with prompt caching on persona + user-profile blocks
- Pydantic models generated from `@notomorrow/domain` JSON Schema
- Structured-output grading for proof verification
- SSE streaming for roadmap generation and chat
- Eval runner that exercises prompts against the [`packages/prompts/evals`]
  suite

**Out:**
- Frontend (lives in `apps/web`)
- App API CRUD (lives in `apps/web`)
- Background scheduling (lives in `infra/inngest`; this service is HTTP-callable)
- Writes outside of `RatingEvent`, `CoachMessage`, and `Roadmap` versions

## Dependencies (consumes)

- `@notomorrow/domain` — JSON Schema → Pydantic via codegen step
- `@notomorrow/prompts` — file reads at runtime
- `@notomorrow/db` — schema is the contract; Coach reads via `asyncpg` /
  SQLAlchemy
- Anthropic API (Opus 4.7 for heavy reasoning, Haiku 4.5 for daily/chat)

## Exposes (HTTP)

| Method | Path | Purpose |
|---|---|---|
| POST | `/roadmap/generate` | SSE: goal → streamed milestones |
| POST | `/roadmap/recalibrate` | Returns diff vs current roadmap |
| POST | `/proof/grade` | `{shipped, quality, gaps[]}` |
| POST | `/coach/daily` | `{primaryTask, stretchTask, coachLine}` |
| POST | `/coach/chat` | SSE: token stream |
| GET | `/healthz` | Liveness |

Auth: shared service token (`Authorization: Bearer <token>`) — callers are
`apps/web` and `infra/inngest`, never end users directly.

## Build steps (ordered)

1. `pyproject.toml` with deps: `fastapi`, `uvicorn`, `anthropic`,
   `pydantic-settings`, `asyncpg`, `sse-starlette`, `python-frontmatter`
2. `uv sync` + Dockerfile skeleton
3. `coach/settings.py` — env loader (Anthropic key, DB URL, service token)
4. `coach/llm/client.py` — Anthropic SDK wrapper with cache-breakpoint support
5. `coach/llm/persona.py` — loads `coach/persona.v1.md`, caches in-process
6. **Codegen:** `scripts/gen_pydantic.py` reads `packages/domain/dist/json-schema.json`
   and emits `coach/schemas/generated.py`
7. `coach/routers/daily.py` — simplest endpoint, end-to-end with Haiku +
   persona cache; use as the integration template
8. `coach/routers/proof.py` — structured output via Anthropic tool-use or JSON
   schema
9. `coach/routers/roadmap.py` — SSE streaming
10. `coach/routers/chat.py` — SSE streaming with conversation context
11. `coach/routers/health.py`
12. `evals/runner.py` — CLI to run eval cases from `packages/prompts/evals/`
13. `tests/` — endpoint smoke tests with mocked Anthropic client

## Acceptance criteria

- [ ] All endpoints reachable; smoke tests pass with mocked LLM
- [ ] At least one endpoint (`/coach/daily`) exercised against real Anthropic
      in an integration test (env-gated)
- [ ] Prompt cache headers visible in Anthropic response metadata; cache hit
      rate logged
- [ ] Pydantic codegen runs deterministically from JSON Schema input
- [ ] Eval runner can execute at least 5 cases across 3 prompts and emit a
      pass/fail report
- [ ] Service starts under Docker; `/healthz` returns 200
- [ ] All writes confined to: `RatingEvent`, `CoachMessage`, `Roadmap` rows

## Verification

```
uv sync
uv run uvicorn coach.main:app --reload
curl -X POST :8000/coach/daily -H 'Authorization: Bearer <token>' \
     -d '{"userId":"<seeded-user-id>"}'
uv run python -m evals.runner --prompt coach/daily-checkin --version 1
```

## Deferred / out of scope

- Multi-tenant rate limiting (relying on `apps/web` to throttle at the edge for
  now)
- Local model fallback
- Streaming responses to a queue for replay (debug feature, later)

## Open questions

- Pydantic codegen: use `datamodel-code-generator` or hand-roll? Hand-rolled is
  faster initially, generator is more sustainable.
- Persistent vs ephemeral chat history — recommendation: persistent, store in
  `CoachMessage` as `kind=chat` rows.

## Coordination

- HTTP contract here is what `apps/web` builds against — keep response shapes
  stable, version with `/v2/...` if breaking.
- Coordinate with `packages/prompts` owner on frontmatter format; loader output
  shape is shared.

## Handoff notes

_None yet._
