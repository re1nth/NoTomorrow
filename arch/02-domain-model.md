# 02 — Domain Model

Entities, what they hold, how they relate. Names use boxing metaphors where the
metaphor adds clarity; internal field names stay literal.

## Entities

| Entity | Purpose | Key fields |
|---|---|---|
| `User` | Account + identity | id, handle, avatar, timezone, joinedAt |
| `RatingProfile` | Per-domain Elo | userId, domain, stamina, expertise, lastUpdated |
| `Goal` | Top-level ambition | userId, title, motivation, horizon (`1w`/`1m`/`3m`/`1y`), targetDate, status |
| `Roadmap` | LLM-generated plan for a Goal | goalId, generatedAt, modelVersion, graph (DAG of milestones) |
| `Milestone` ("Round") | Major checkpoint | roadmapId, order, title, deliverable, dueDate, status |
| `Task` ("Punch") | Atomic action | milestoneId, type, estMinutes, dueDate |
| `ProofOfWork` | Evidence of completion | taskId, kind, payload, verifiedAt, score |
| `TrainingLog` | Daily check-in | userId, date, mood, hoursTrained, blockers, coachReply |
| `RatingEvent` | Atomic Elo change | userId, domain, delta (stamina, expertise), reason, sourceProofId |
| `Bundle` | Reusable goal template | authorId, sourceGoalId, title, tags, stars, forks |
| `CoachMessage` | Persona communication | userId, channel (`inbox`/`push`), tone, body, ctaTaskId |
| `Rival` | Opponent on leaderboard | userId, archetype, domain |

## Punch taxonomy (Task.type)

Encodes effort, drives UI iconography, and feeds rating math.

- **jab** — under 30 min
- **hook** — half-day
- **uppercut** — full day
- **dempsey roll** — multi-day milestone capstone

## Proof kinds (ProofOfWork.kind)

- `repo` — GitHub URL; coach fetches readme + recent commits
- `url` — deployed site or service; coach hits the endpoint
- `video` — Loom/YouTube demo
- `writeup` — markdown reflection / postmortem

## Relationships

```
User 1—N Goal 1—1 Roadmap 1—N Milestone 1—N Task 1—N ProofOfWork
User 1—N RatingProfile (one per domain)
User 1—N TrainingLog
User 1—N RatingEvent
User 1—N CoachMessage
Bundle N—1 User (author); Bundle forks→ new Goal
```

## Status enums

- `Goal.status`: `draft` | `active` | `paused` | `won` | `abandoned`
- `Milestone.status`: `locked` | `current` | `cleared` | `failed`
- `Task.status`: `pending` | `submitted` | `verified` | `rejected`
