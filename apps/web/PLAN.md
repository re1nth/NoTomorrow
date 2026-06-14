# apps/web — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 2.** Depends on `domain`, `db`, `ui`, and `apps/coach` stubs.

## Mission

The user-facing Next.js 15 app plus the App API route handlers. Owns auth,
CRUD, the UI experience, and acts as the single client to the Coach Service.

## Scope

**In:**
- Next.js 15 App Router + React Server Components
- Auth via `next-auth` (email magic link + Google)
- App API route handlers (REST surface in [arch/07-api.md](../../arch/07-api.md))
- User surfaces in [arch/04-frontend.md](../../arch/04-frontend.md)
- Coach Service HTTP client (typed)
- SSE consumption for roadmap streaming + coach chat
- Inngest function registration at boot (functions live in `infra/inngest`)
- Theme + components from `@notomorrow/ui`

**Out (for MVP — see [arch/08-mvp.md](../../arch/08-mvp.md)):**
- Bundle marketplace
- Rivals leaderboard
- Multi-domain ratings UI (single-domain only)
- Video and repo-scan proof kinds (URL only)
- Push notifications (email only)

## Dependencies (consumes)

- `@notomorrow/domain` — request/response shapes
- `@notomorrow/db` — `createDb`, schema exports
- `@notomorrow/ui` — theme preset, components
- `apps/coach` over HTTP — see TRACKER interface contract
- Redis for sessions + streak counters
- S3/R2 for proof artifact uploads

## Exposes

- User-facing site at `/`
- REST API under `/api/*`
- Inngest endpoint at `/api/inngest` (the dev server hits this)

## Build steps (ordered)

### Scaffolding
1. `next create` → Next.js 15, TS, Tailwind, App Router
2. Wire `@notomorrow/ui` Tailwind preset
3. `lib/env.ts` — typed env loader (Zod)
4. `lib/db.ts` — re-export Drizzle client from `@notomorrow/db`
5. `lib/coach-client.ts` — typed HTTP client to Coach Service
6. `next-auth` config with email + Google providers

### App API (in priority order)
7. `app/api/goals/route.ts` — POST creates goal, triggers roadmap gen
8. `app/api/goals/[id]/roadmap/route.ts` — GET current roadmap
9. `app/api/tasks/[id]/proof/route.ts` — POST submits proof, enqueues verify
10. `app/api/training-log/route.ts` — POST daily check-in
11. `app/api/rating/route.ts` — GET ratings
12. `app/api/coach/inbox/route.ts` — GET messages
13. `app/api/coach/chat/route.ts` — SSE chat passthrough
14. `app/api/webhooks/github/route.ts` — proof verification webhook
15. `app/api/inngest/route.ts` — Inngest function registration

### UI surfaces (in priority order — matches MVP definition of done)
16. Onboarding flow: sign in → diagnostic → initial rating
17. Gym (home): today's training card, coach message, streak
18. Goal creator (chat-driven, streams roadmap)
19. Roadmap view (boxing-ring board)
20. Round view (tasks + proof submission)
21. Rating dashboard

### Polish
22. KO animation on milestone clear
23. Bell sound (opt-in) on round start
24. Empty states (themed)

## Acceptance criteria

- [ ] User can complete the full MVP flow in [arch/08-mvp.md](../../arch/08-mvp.md)
- [ ] All API routes typed end-to-end (Zod request validation; typed responses)
- [ ] Coach client retries idempotent calls; SSE reconnects on drop
- [ ] Auth-protected routes return 401 when unauthenticated
- [ ] Lighthouse perf score > 85 on Gym home
- [ ] Mobile breakpoints render the Roadmap view legibly (read-only is enough
      for MVP)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean

## Verification

```
docker compose up -d
pnpm --filter @notomorrow/db migrate
pnpm --filter @notomorrow/db seed
pnpm dev   # runs web + coach + inngest via turbo
```

Walk through the MVP flow as the seeded demo user.

## Deferred / out of scope

- Bundle publish/fork UI
- Rivals leaderboard
- Settings page beyond profile basics
- Marketing site (separate later, not in this app)

## Open questions

- tRPC vs REST for the App API: REST in plan ([arch/07-api.md](../../arch/07-api.md)).
  Revisit if frontend type ergonomics suffer.
- Where does the onboarding diagnostic live — App API calls Coach Service per
  question, or fetches a full set up front? Recommendation: full set up front
  to avoid per-question latency.

## Coordination

- This app is the **only** human-facing surface. UI/UX decisions land here but
  must use `@notomorrow/ui` tokens — no inline theme values.
- All Coach Service calls go through `lib/coach-client.ts`. No raw fetches
  scattered across routes.
- If you need a new Coach Service endpoint, file the change against
  `apps/coach/PLAN.md` and add a row to TRACKER "Pending interface changes".

## Handoff notes

_None yet._
