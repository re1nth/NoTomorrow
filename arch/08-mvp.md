# 08 — MVP Slice

4–6 weeks of build. Scope chosen to prove the core loop works: *goal in → coach
plan → ship proof → rating moves*. If that loop is dull or wrong, nothing else
matters.

## In scope

1. **Auth + onboarding diagnostic**
   - Email + Google sign-in
   - Self-rating + 10-question diagnostic for one starting domain
2. **Single-domain rating** — start with `web-frontend` (broad audience, easy
   proof verification)
3. **Goal creation → roadmap generation**
   - No DAG yet, just an ordered list of 5–8 milestones
   - LLM streams the plan in
4. **Task list with proof-by-URL only**
   - User submits a deployed URL
   - Coach fetches, screenshots, scores
5. **Daily coach message**
   - Delivered to in-app inbox + email
   - Single primary task per day
6. **Rating dashboard**
   - Stamina + Expertise numbers, simple history list
7. **Hajime no Ippo theme**
   - Applied to home + roadmap pages
   - Lottie KO animation on milestone clear
   - One toggleable sound effect (bell)

## Out of scope (defer)

- Bundle marketplace (publish/fork)
- Rivals leaderboard
- Multi-domain ratings
- Video and repo-scan proof kinds
- Sparring session modal
- Weekly recalibration loop (do manually for first cohort)
- Push notifications (email only at first)

## Definition of done for MVP

A new user can:

1. Sign up
2. Take the diagnostic and see an initial rating
3. Create a goal with a 1-month horizon
4. See a generated roadmap with 5–8 milestones
5. Receive a daily email with today's task
6. Submit a URL as proof
7. See their rating move (or get rejected with concrete feedback)
8. Clear a milestone and see the KO animation

If that flow feels alive and a small cohort uses it for two weeks, the bet is
working.

## Build order suggestion

1. Data model + Postgres schema
2. Auth + onboarding
3. Goal create + roadmap gen (LLM happy path, no proof yet)
4. Roadmap view (read-only, themed)
5. Proof submission + verification
6. Rating math + dashboard
7. Daily email loop
8. KO animation + final theme polish
