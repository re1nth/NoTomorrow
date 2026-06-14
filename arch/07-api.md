# 07 — API Surface

First sketch. REST shape; tRPC is a reasonable alternative if the frontend ends
up coupled to the App API repo.

## Goals & roadmaps

```
POST   /goals                       create goal; triggers roadmap generation
GET    /goals                       list user's goals
GET    /goals/:id                   goal detail
PATCH  /goals/:id                   edit title, motivation, status
DELETE /goals/:id                   abandon goal

GET    /goals/:id/roadmap           current roadmap (latest version)
GET    /goals/:id/roadmap/history   version history
POST   /goals/:id/roadmap/regenerate force a recalibration
POST   /goals/:id/roadmap/accept    accept a proposed recalibration diff
```

## Milestones & tasks

```
GET    /milestones/:id              detail + child tasks
GET    /tasks/:id                   task detail
POST   /tasks/:id/proof             submit proof; triggers verification job
GET    /tasks/:id/proofs            history of submissions for this task
```

## Training & ratings

```
POST   /training-log                daily check-in
GET    /training-log?from&to        history

GET    /rating                      all domains for current user
GET    /rating/:domain              detail + recent RatingEvents
GET    /rating/:domain/history      sparkline data
```

## Coach

```
GET    /coach/inbox                 unread CoachMessages
POST   /coach/inbox/:id/read        mark read
POST   /coach/chat                  free-form chat (SSE stream)
```

## Rivals & bundles

```
GET    /rivals                      matched leaderboard for current user
GET    /rivals/:userId              public profile (handle, ratings, fight history)

GET    /bundles?q=&domain=          search shareable bundles
GET    /bundles/:id                 bundle detail
POST   /bundles                     publish current goal as a bundle
POST   /bundles/:id/fork            clone bundle as a new goal
POST   /bundles/:id/star            star/unstar
```

## Webhooks (inbound)

```
POST   /webhooks/github             commit/PR events for proof auto-verification
```

## Streaming endpoints

These use SSE rather than JSON:

- `POST /goals` — streams milestones as roadmap generates
- `POST /coach/chat` — streams tokens

## Auth

Standard session cookie via next-auth. All endpoints except public bundle reads
require auth. Rate limits per user, separate buckets for read / write /
LLM-triggering routes.
