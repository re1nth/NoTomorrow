# apps/coach

Python FastAPI service that owns LLM orchestration for NoTomorrow:
roadmap generation, proof grading, daily coach messages, free-form chat.

See [`PLAN.md`](./PLAN.md) for mission, scope, acceptance criteria.

## Local dev

```bash
uv sync
uv run uvicorn coach.main:app --reload --port 8000
```

Required env vars (see `src/coach/settings.py`):

- `ANTHROPIC_API_KEY` — Anthropic API key
- `COACH_SERVICE_TOKEN` — shared bearer token (apps/web + infra/inngest use this)
- `DATABASE_URL` — postgres connection URL (asyncpg)
- `COACH_MODEL_HEAVY` — defaults to `claude-opus-4-7`
- `COACH_MODEL_LIGHT` — defaults to `claude-haiku-4-5-20251001`
- `COACH_PROMPTS_ROOT` — defaults to `../../packages/prompts/prompts`
- `EVAL_MOCK` — set to `1` to stub Anthropic in the eval runner

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/healthz` | Liveness + model versions |
| POST | `/coach/daily` | JSON `{primaryTask, stretchTask, coachLine}` |
| POST | `/proof/grade` | JSON `{shipped, quality, gaps[], verdict, ratingDelta}` |
| POST | `/roadmap/generate` | SSE stream of `goal_created` / `milestone` / `done` events |
| POST | `/roadmap/recalibrate` | JSON diff vs current roadmap |
| POST | `/coach/chat` | SSE token stream |

All endpoints except `/healthz` require `Authorization: Bearer <COACH_SERVICE_TOKEN>`.

## Smoke curls

```bash
TOKEN=local-dev-token
BASE=http://localhost:8000

# health
curl -s $BASE/healthz | jq

# daily
curl -s -X POST $BASE/coach/daily \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "userId":"00000000-0000-0000-0000-000000000001",
    "userHandle":"ippo",
    "localDate":"2026-06-14",
    "activeGoals":[{"title":"Ship a Pomodoro web app","horizon":"1m","currentMilestoneTitle":"Hello world deploy"}],
    "ratingSnapshot":{"stamina":820,"expertise":790,"delta7d":{"stamina":0,"expertise":0}},
    "recentTrainingLog":[],
    "openTasks":[{"title":"Wire up Next.js scaffold","type":"jab","estMinutes":30}]
  }' | jq

# proof grade
curl -s -X POST $BASE/proof/grade \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "taskId":"00000000-0000-0000-0000-000000000010",
    "taskTitle":"Deploy hello world","taskType":"jab",
    "milestoneTitle":"Round 1","milestoneDeliverable":{"kind":"url","description":"Live URL"},
    "proofKind":"url","proofPayload":{"kind":"url","url":"https://example.com"},
    "userRating":{"stamina":820,"expertise":790}
  }' | jq

# roadmap (SSE)
curl -N -X POST $BASE/roadmap/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "userId":"00000000-0000-0000-0000-000000000001",
    "goalId":"00000000-0000-0000-0000-000000000020",
    "userHandle":"ippo",
    "goalTitle":"Ship a Pomodoro web app",
    "goalMotivation":"Want to learn React end-to-end",
    "horizon":"1m","targetDate":"2026-07-14",
    "ratingSnapshot":{"stamina":820,"expertise":790}
  }'

# recalibrate
curl -s -X POST $BASE/roadmap/recalibrate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "userId":"00000000-0000-0000-0000-000000000001",
    "goalId":"00000000-0000-0000-0000-000000000020",
    "userHandle":"ippo","goalTitle":"Ship a Pomodoro web app",
    "currentRoadmap":{},
    "weekSummary":{"tasksCompleted":4,"tasksMissed":1,"milestonesCleared":1,"missedDeadlines":0,"ratingDelta":{"stamina":12,"expertise":8},"hoursTrained":7,"blockers":""},
    "ratingSnapshot":{"stamina":832,"expertise":798},
    "ratingHistory4w":[],
    "todayDate":"2026-06-14"
  }' | jq

# chat (SSE)
curl -N -X POST $BASE/coach/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "userId":"00000000-0000-0000-0000-000000000001",
    "userHandle":"ippo","message":"I missed yesterday. What now?",
    "activeGoals":[],"recentTrainingLog":[],
    "ratingSnapshot":{"stamina":820,"expertise":790}
  }'
```

## Tests

```bash
uv run pytest
```

Tests stub the Anthropic client; no API key required.

## Eval runner

```bash
EVAL_MOCK=1 uv run python -m evals.runner --prompt coach/daily-checkin --version 1
```
