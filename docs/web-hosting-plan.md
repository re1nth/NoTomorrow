# Hosting NoTomorrow as a web service

Design doc for turning the current local-only desktop app into a hosted
web service while keeping the desktop `.app` fully functional as a
local-only runtime.

## 1. Decisions locked in

| Question | Answer |
| --- | --- |
| Database | SQLite on a Fly.io volume (single node) |
| Auth | Auth.js v5, Google OAuth only (no email/password, no magic link) |
| Desktop after launch | Keep both modes — desktop stays local-only, web is multi-tenant |
| Host | Fly.io Machines |

Everything below follows from these four choices.

## 2. Current architecture (recap)

- `apps/web` — Next.js 15 (App Router, React 19). Client pages under
  `app/(app)/{counters,pomodoro}` and REST route handlers under
  `app/api/counters`.
- `apps/desktop` — Electron shell that sets `SQLITE_DB_PATH`, runs
  Drizzle migrations, ensures one local user exists, boots Next
  in-process, and loads it into a `BrowserWindow`. Also wires a macOS
  menu-bar tray for the Pomodoro buzz.
- `packages/db-sqlite` — Drizzle schema (`users`, `counters`,
  `counter_check_ins`) plus migrations. Native driver is
  `better-sqlite3`.
- `packages/ui` — shared Tailwind preset, base components, Lottie.

Every API route already scopes queries with `eq(x.userId, user.id)`.
Every table is already keyed by `userId`. The only thing single-tenant
about the app today is the auth layer: `getUserId()` returns the single
row in `users`.

## 3. Target topology

```
Internet ──> Fly proxy (TLS) ──> Fly Machine (Node 20, next start)
                                        │
                                        ├── /data/notomorrow.db (volume)
                                        └── nightly backup ──> Tigris bucket
```

- One Fly Machine, 1 vCPU / 1 GB RAM to start. Scale up vertically as
  needed; horizontal scale is out of scope while we're on SQLite.
- Persistent volume `notomorrow_data` mounted at `/data`.
- `SQLITE_DB_PATH=/data/notomorrow.db`.
- Fly volume snapshots enabled, plus a nightly `sqlite3 .backup` to
  Tigris for point-in-time restore separate from the volume.
- Domain (TBD) pointed at the Fly app; Fly terminates TLS.

## 4. The core abstraction: `NOTOMORROW_AUTH`

One env var toggles the auth strategy:

- `NOTOMORROW_AUTH=local` — desktop. `requireUser()` returns the single
  row in `users` (today's behavior).
- `NOTOMORROW_AUTH=cloud` — web. `requireUser()` reads the Auth.js
  session cookie and looks up the user by session id.

Every route handler stays byte-identical. The seam is
`apps/web/lib/auth.ts`.

```ts
// apps/web/lib/auth.ts  (proposed shape)
const strategy = process.env.NOTOMORROW_AUTH === 'cloud'
  ? cloudStrategy
  : localStrategy;

export async function requireUser() {
  return strategy.requireUser();
}
```

`localStrategy` is the current implementation, unchanged.
`cloudStrategy` calls `auth()` from the Auth.js instance and returns
`{ id, timezone }` — same contract.

Desktop launcher sets `NOTOMORROW_AUTH=local` explicitly in
`apps/desktop/src/main/main.ts` before starting Next. The Fly deploy
sets `NOTOMORROW_AUTH=cloud` in `fly.toml`.

## 5. Schema additions

Migration `0005_web_auth.sql`. All additive — desktop DBs pick up the
new columns/tables but never populate them.

Extend `users`:
- `email TEXT UNIQUE` (nullable — local mode never sets it)
- `email_verified TEXT` (ISO string, populated by Auth.js)
- `image TEXT` (Google avatar URL)

Add Auth.js Drizzle-adapter tables verbatim from the adapter's canonical
schema:
- `accounts` — OAuth provider linkage
- `sessions` — `session_token`, `user_id`, `expires`
- `verification_tokens` — kept for adapter compatibility even though we
  don't use email

No changes to `counters`, `counter_check_ins`, `perf_sessions`.

## 6. Route additions (cloud only)

- `app/(auth)/login/page.tsx` — a Google-only sign-in button.
- `app/api/auth/[...nextauth]/route.ts` — Auth.js catch-all.
- `app/(app)/layout.tsx` — in cloud mode, redirect unauthed users to
  `/login`. In local mode keep today's `notFound()` fallback.
- `app/page.tsx` — split: signed-out sees the current marketing hero;
  signed-in redirects to `/counters`.
- `app/(app)/settings/page.tsx` — edit handle + timezone, delete
  account. Optional in Phase 3.
- `app/api/health/route.ts` — 200 OK for the Fly health check.

## 7. First-login flow (Google)

When a Google sign-in succeeds and no `users` row exists for that email:
1. Auth.js adapter creates the base user row (id, email, image).
2. A post-signin callback fills in `handle` (slug of email localpart,
   deduped with a numeric suffix) and `timezone` (captured client-side
   at signin and posted with the callback, or defaulted to `UTC` and
   corrected in `/settings`).
3. First page load lands on `/counters` with an empty state.

Timezone capture detail: the sign-in page reads
`Intl.DateTimeFormat().resolvedOptions().timeZone` and passes it as a
query param on the OAuth start URL; the callback reads it back.

## 8. Web-native Pomodoro

`apps/web/app/(app)/pomodoro/page.tsx` already feature-detects
`window.notomorrow`. Add a browser fallback branch when the bridge is
missing:

- On first mount, if `Notification.permission === 'default'`, call
  `Notification.requestPermission()` behind a small inline "Enable
  notifications" affordance.
- On buzz: `new Notification('Pomodoro finished', ...)` + flash
  `document.title` between two glyphs on a 600ms interval + a short
  WebAudio ping.
- On clear: restore title, close the Notification.

Zero API changes. One file gets the fallback branch.

## 9. Packaging and deploy

New files:
- `apps/web/Dockerfile` (multi-stage: pnpm fetch, `pnpm install
  --frozen-lockfile`, build workspace, prune to prod deps, `next start`)
- `apps/web/docker-entrypoint.sh` — runs migrations against
  `/data/notomorrow.db`, then execs `node_modules/.bin/next start`
- `fly.toml` at repo root — one Machine, one region, one volume mount,
  `NOTOMORROW_AUTH=cloud`, secrets for `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`

Native module note: `better-sqlite3` builds against the container's
Node ABI at image-build time, so no `electron-rebuild` gymnastics. The
existing `apps/web` Next config already marks `better-sqlite3` /
`bindings` as `serverExternalPackages`, so this Just Works.

Deploy flow:
1. `flyctl launch --no-deploy` (once) to generate the app + volume.
2. `flyctl volumes create notomorrow_data --size 3`.
3. `flyctl secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
   AUTH_SECRET=$(openssl rand -hex 32)`.
4. `flyctl deploy` (from CI eventually).

## 10. Backups

Two layers:
- Fly volume snapshots (built-in, daily, ~5-day retention).
- Nightly `sqlite3 /data/notomorrow.db ".backup /tmp/n.db"` then
  `aws s3 cp` to Tigris. Retention: last 14 daily + 8 weekly.

The backup script runs as a cron machine (`flyctl machine run` with a
schedule) or as an in-process `node-cron` job on the main machine —
decide when we get there; leaning toward in-process for simplicity.

## 11. Rate limiting

A small in-process token bucket keyed by `user.id`, applied to all
`POST/PATCH/DELETE /api/*` routes. Single-node deploy makes in-memory
state fine. Numbers to start: 60 writes/min per user, 600/hour.

Not planning any anonymous-user rate limiting — the whole surface is
auth-gated.

## 12. Phase-by-phase punch list

Each phase should land as one or two PRs. Every phase leaves the
desktop app fully functional.

### Phase 1 — auth seam (invisible refactor)
- Add `NOTOMORROW_AUTH` env; default to `local`.
- Split `apps/web/lib/auth.ts` into `local.ts` / `cloud.ts` (stub) with
  a shared `Strategy` interface.
- `apps/desktop/src/main/main.ts` sets `NOTOMORROW_AUTH=local`
  explicitly.
- No behavior change. Existing tests stay green.

### Phase 2 — Auth.js wiring
- `pnpm add next-auth@5 @auth/drizzle-adapter` in `apps/web`.
- Migration 0005: `users` columns + `accounts`/`sessions`/`verification_tokens`.
- `app/api/auth/[...nextauth]/route.ts` with Google provider.
- `app/(auth)/login/page.tsx`.
- `app/(app)/layout.tsx` cloud-mode redirect.
- Flesh out `cloudStrategy.requireUser()` to read the session.
- Local development: run with `NOTOMORROW_AUTH=cloud` and a throwaway
  Google OAuth app pointed at `http://localhost:3000`.

### Phase 3 — landing + first-login polish
- Split `app/page.tsx` into signed-out marketing / signed-in redirect.
- Timezone capture at signin.
- `app/(app)/settings/page.tsx` — edit handle/timezone, delete account.

### Phase 4 — Pomodoro browser fallback
- `apps/web/app/(app)/pomodoro/page.tsx` gets the browser branch.
- One-shot manual verification in Chrome + Safari.

### Phase 5 — packaging and deploy
- `apps/web/Dockerfile` + `apps/web/docker-entrypoint.sh`.
- `fly.toml` at repo root.
- `apps/web/app/api/health/route.ts`.
- `flyctl launch`, volume create, secrets, first deploy.
- Point domain at Fly.

### Phase 6 — ops
- Nightly SQLite backup to Tigris (in-process cron).
- In-process rate limiter middleware.
- Sentry, or defer if we're happy with `flyctl logs` at this scale.

## 13. What the desktop app looks like at the end

Unchanged, structurally. `apps/desktop/src/main/main.ts` gains one line
setting `NOTOMORROW_AUTH=local`. Everything else — the tray, the
in-process Next boot, the local SQLite file, `ensureLocalUser` — stays
exactly as it is. The desktop `.app` continues to be a fully offline,
account-free experience.

## 14. Rollback story

- Phase 1 is a pure refactor; rollback is `git revert`.
- Phase 2's migration is additive; rollback is `git revert` on the
  migration file plus removing the columns/tables manually if we ever
  need to fully undo (unlikely).
- Phases 3–4 are user-visible additions only; safe to revert.
- Phase 5 deploy failures roll back with `flyctl releases rollback`.

## 15. Open questions

- Domain name for the hosted service (needed before Phase 5).
- Google Cloud project owner/billing — needs an account to create the
  OAuth client. Whoever owns it holds the client secret.
- Marketing landing copy — the current `app/page.tsx` is aimed at
  someone who's about to sign in; do we want a separate landing that
  actually explains the product?
- Delete-account UX — hard delete (cascades wipe check-ins and perf
  sessions) or soft delete with a 30-day grace? Leaning hard delete for
  now given the low-stakes data.
