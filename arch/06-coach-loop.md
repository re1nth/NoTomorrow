# 06 — Coach Loop

The orchestration that makes the coach feel present. Three loops: daily,
on-submission, weekly.

## Daily check-in

```
Trigger: 07:00 user-local (Inngest cron, per-user schedule)

Coach Service:
  read: user's active goals, last 7 days of TrainingLog, current ratings
  prompt-cache: coach persona block + user profile block
  call: Claude Haiku 4.5
  output:
    - 1 primary task ("today's punch")
    - 1 stretch task
    - 1 coaching line (specific, references yesterday)

Persist: CoachMessage (channel=inbox)
Notify: push notification + email (user-configurable channels)
```

## On proof submission

```
Trigger: POST /tasks/:id/proof

App API:
  validate payload, store ProofOfWork (status=submitted)
  enqueue verification job

Coach Service (job):
  fetch artifact (see 05-backend.md proof pipeline)
  call: Claude Opus 4.7 with structured output schema
  if pass:
    write RatingEvent (delta computed via 03-rating-system.md math)
    advance Milestone if all child tasks verified
    if milestone cleared: emit KO event for frontend animation
  if fail:
    write CoachMessage with concrete revision asks
    Task.status = rejected (user can resubmit)
```

## Weekly recalibration

```
Trigger: Sunday 20:00 user-local

Coach Service:
  read: last week's RatingEvents, missed deadlines, completed milestones
  call: Claude Opus 4.7
  prompt: "the boxer has improved in X, struggles with Y, replan the remaining
           rounds for goal Z"
  output: diff vs current Roadmap (added rounds, removed rounds, retitled)

Present to user as a proposed change:
  - user can accept, reject, or edit
  - accepted diff becomes new Roadmap version
  - old Roadmap kept for history
```

## Streaming

Long-running LLM calls stream to the client via SSE so the coach feels alive:

- Roadmap generation streams milestones as they're produced
- Free-form chat streams tokens
- Proof verification is async (job + push notification when done)

## Prompt caching strategy

Two large reused blocks are cache-hot:

1. **Coach persona** (~5k tokens) — voice, principles, do/don't examples. Same
   for every user.
2. **User profile snapshot** (~1–2k tokens) — handle, active goals, current
   ratings, recent training log. Refreshed per session.

With caching, daily Haiku check-ins land in the cents-per-month range per user;
without it, dollars. This is a load-bearing optimization, not a polish item.

## Eval suite (must exist before launch)

- 50 representative goals → roadmap-quality rubric
- 30 proof artifacts (good + bad mix) → grading consistency check
- Run on every prompt or model version change; gate deploys on regression
