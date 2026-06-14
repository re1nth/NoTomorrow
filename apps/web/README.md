# apps/web — NoTomorrow

Next.js 15 (App Router) + React 19 user surface and App API.

## Stack

- Next 15, React 19, TypeScript
- Tailwind 3 with the `@notomorrow/ui` preset
- next-auth v4 (JWT sessions)
- Drizzle via `@notomorrow/db`
- Inngest functions registered at `/api/inngest`
- All Coach Service traffic funnelled through `lib/coach-client.ts`

## Dev startup

```bash
# from the repo root
pnpm install
docker compose up -d postgres redis
pnpm --filter @notomorrow/db migrate
pnpm --filter @notomorrow/db seed

# in three terminals (or one with turbo)
pnpm --filter web dev          # Next.js on :3000
pnpm --filter apps/coach dev   # Coach Service on :8001
npx inngest-cli@latest dev     # Inngest dev server on :8288
```

Set the following in `.env.local` (or `.env`):

```
NEXTAUTH_SECRET=...                 # any random string for dev
DATABASE_URL=postgres://...
COACH_SERVICE_URL=http://localhost:8001
COACH_SERVICE_TOKEN=...
# Optional:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## Golden-path walkthrough

1. Visit `http://localhost:3000` and click **Step into the ring**.
2. On `/sign-in`, enter any email — the dev credentials provider upserts
   you into the `users` table and creates a session.
3. You land on `/onboarding`. Answer the 10-question diagnostic for the
   `web-frontend` domain.
4. Click **Set your first goal** to land on `/goals/new`. Fill in title,
   motivation, horizon (1m), and target date.
5. POST creates the goal synchronously; the `RoadmapStreamer` mounts and
   streams milestones over SSE from `POST /api/goals/:id/roadmap/stream`.
6. Click into the goal, then into a milestone, then a task. Submit a URL
   proof; the row writes to `proofs_of_work` and dispatches
   `proof/submitted` to Inngest.
7. The `verify-proof` function (in `infra/inngest`) calls Coach Service
   `/proof/grade` and inserts a `RatingEvent`; rebuild the rating page to
   see stamina/expertise move.
8. Watch the home page (`/gym`) for the daily coach message once the
   daily-coach cron fires (or trigger it manually via `inngest-cli`).

## Test

```bash
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test
```

## Notes

- Auth ships with a dev credentials provider so the full flow works
  without an SMTP server or OAuth keys. Google sign-in activates
  automatically when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set.
  Email magic-link transport is stubbed: configure `EMAIL_SERVER` /
  `EMAIL_FROM` to enable.
- Coach Service must be running for the roadmap stream and chat
  endpoints to return meaningful data. Without it, those calls error
  through the SSE channel with `{ type: 'error', message: ... }`.
- The `lib/inngest.ts` module wires a Drizzle-backed `DbAdapter` to
  `@notomorrow/inngest` at module load — importing it from any route
  guarantees the cron + verify functions can persist results.
- All `@notomorrow/ui` imports are routed through `@/lib/ui` so the
  client/server boundary lives in one place (several UI components rely
  on React hooks).
- `lib/env.ts`, `lib/db.ts`, and `lib/coach-client.ts` are lazy: env
  validation and pool creation happen on first access, not at module
  load, so `next build` can collect page data without infra.
