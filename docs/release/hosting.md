# Hosting — Fly.io deploy plan

Picks up where [`../web-hosting-plan.md`](../web-hosting-plan.md) §9-11
leaves off, adjusted for the auth stack that actually shipped
(email/password + verification, not Google OAuth).

## 1. Topology

```
Internet ──> Fly proxy (TLS) ──> Fly Machine (Node 20, next start, single instance)
                                        │
                                        ├── /data/notomorrow.db (Fly volume, 3 GB)
                                        └── nightly sqlite3 .backup ──> Tigris bucket
```

- **One Fly Machine**, `shared-cpu-1x` / 1 GB RAM. Runs the Next server
  and (for now) the in-process backup cron. Scales up vertically.
  Horizontal is out of scope while we're on SQLite.
- **One volume**, `notomorrow_data`, mounted at `/data`.
- **One region** — pick the one closest to your target audience.
  `ord` (Chicago), `sjc` (San Jose), or `bom` (Mumbai) are common. Fly
  charges per-machine per-region; single region = cheapest.
- **`SQLITE_DB_PATH=/data/notomorrow.db`** so the volume is the DB.

## 2. Container image

New files:

- **`apps/web/Dockerfile`** — multi-stage.
  1. **deps** stage: `node:20-alpine`, install pnpm, `pnpm fetch`
     from the workspace lockfile, then `pnpm install --frozen-lockfile
     --offline` for `apps/web` and its workspace deps.
  2. **build** stage: `pnpm --filter web build`. This produces
     `.next/standalone/` (Next's standalone output — trims to the
     minimum node_modules needed). Requires enabling
     `output: 'standalone'` in `apps/web/next.config.ts`.
  3. **runtime** stage: `node:20-alpine`. Copy the standalone
     output, the `public/` folder, the `.next/static/` folder, and
     the drizzle migrations from `packages/db-sqlite/migrations`.
     `EXPOSE 3000`. `ENTRYPOINT ["/app/docker-entrypoint.sh"]`.
- **`apps/web/docker-entrypoint.sh`** — three lines:
  ```sh
  #!/bin/sh
  set -e
  node run-migrations.mjs   # applies db-sqlite migrations to $SQLITE_DB_PATH
  exec node server.js       # from .next/standalone
  ```
  `run-migrations.mjs` is a tiny script that opens
  `$SQLITE_DB_PATH` via `better-sqlite3` and calls drizzle's
  `migrate()` against the migrations folder baked into the image.

Notes:
- `better-sqlite3` compiles against the container's Node ABI at
  image-build time. No electron-rebuild needed (that's a desktop-only
  concern).
- `apps/web/next.config.ts` already marks `better-sqlite3` and
  `bindings` as `serverExternalPackages` — keep that as-is; standalone
  respects it.
- Add `.dockerignore` covering `.next/`, `node_modules`, `dist/`,
  `.data/`, `.env.local`. Otherwise the build context is huge.

Local smoke test before you deploy:
```
docker build -t notomorrow-web -f apps/web/Dockerfile .
docker run --rm -p 3000:3000 \
  -e NOTOMORROW_AUTH=cloud \
  -e SQLITE_DB_PATH=/data/notomorrow.db \
  -e AUTH_SECRET=$(openssl rand -hex 32) \
  -e AUTH_TRUST_HOST=true \
  -e RESEND_API_KEY=... \
  -v $(pwd)/.docker-data:/data \
  notomorrow-web
```
Open `http://localhost:3000`, register, verify (code will be in the
Resend dashboard if `RESEND_API_KEY` is set, otherwise in the docker
logs via the fallback mailer). If that works, the Fly deploy is a
formality.

## 3. Email delivery

The current `apps/web/lib/mailer.ts` logs to stdout. Ship needs real
email. **Resend** is the recommended provider — 3k emails/month free,
tiny SDK, works in serverless and container runtimes.

### Signup

1. Create a Resend account at [resend.com](https://resend.com).
2. Generate an API key. Store as Fly secret `RESEND_API_KEY`.
3. **Sending identity — two paths:**
   - **Sandbox (no domain setup):** send from `onboarding@resend.dev`.
     Users see "onboarding@resend.dev" in their inbox. Works for a
     soft launch. Deliverability is fine because Resend controls the
     domain.
   - **Own domain (recommended for real launch):** add DNS records
     Resend gives you (SPF + DKIM, ~5 min in Cloudflare). Send from
     `noreply@<yourdomain>`.

### Code change

Update `apps/web/lib/mailer.ts`:

```ts
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function deliver(msg: Message): Promise<void> {
  if (resend) {
    await resend.emails.send({
      from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
      to: msg.to,
      subject: msg.subject,
      text: msg.body,
    });
    return;
  }
  // fallback: log-only, for local dev
  console.log(`[dev-email] to=${msg.to} subject=${msg.subject}\n${msg.body}`);
}
```

`pnpm --filter web add resend`. That's the whole change on the app side.

### Deliverability watch

The signup / password reset emails are transactional and short — low
spam risk. But Gmail specifically flags brand-new sending domains
harshly for the first 100-200 sends. If you're launching with your
own domain, either:
- Warm it up by sending yourself 10 emails/day for a week before
  launch, or
- Ship on `onboarding@resend.dev` for the first week and switch to your
  domain once you know deliverability is clean.

## 4. Secrets

Set once per deployment:

```
flyctl secrets set \
  AUTH_SECRET=$(openssl rand -hex 32) \
  RESEND_API_KEY=re_... \
  MAIL_FROM=noreply@<yourdomain>
```

Non-secret env goes in `fly.toml` under `[env]`:

```
[env]
  NOTOMORROW_AUTH = "cloud"
  AUTH_TRUST_HOST = "true"
  SQLITE_DB_PATH  = "/data/notomorrow.db"
  NODE_ENV        = "production"
```

## 5. Domain + TLS

1. Buy a domain. Cheap picks: `notomorrow.app` (~$14/yr on
   Cloudflare), `notomorrow.xyz` (~$1/yr for the first year), or
   whatever you prefer.
2. In DNS, create an `A` record `@` → the Fly app's IPv4 (from
   `flyctl ips list`) and `AAAA` for IPv6.
3. `flyctl certs create <yourdomain>` — Fly issues a Let's Encrypt
   cert automatically once DNS propagates. ~2-5 min.
4. Repeat for `www` if you want it.

Until the domain is live, the app is reachable at
`https://<appname>.fly.dev` — that's your soft-launch URL.

## 6. Health check

Add `apps/web/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() { return NextResponse.json({ ok: true }); }
```

Wire it in `fly.toml`:
```
[[services.http_checks]]
  path = "/api/health"
  method = "get"
  interval = "30s"
  timeout  = "5s"
```

## 7. Backups

Two layers, matching `web-hosting-plan.md` §10:

- **Fly volume snapshots** — built-in, daily, ~5-day retention. Free.
- **Nightly SQLite `.backup` to Tigris (Fly-managed S3)** — one node
  cron job, runs at 03:00 UTC:
  ```ts
  cron.schedule('0 3 * * *', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    await execFile('sqlite3', [
      '/data/notomorrow.db',
      `.backup /tmp/nt-${stamp}.db`,
    ]);
    await uploadToTigris(`/tmp/nt-${stamp}.db`, `backups/nt-${stamp}.db`);
    await fs.unlink(`/tmp/nt-${stamp}.db`);
  });
  ```
  Retention: keep the last 14 daily + 8 weekly. Prune in the same job.

The in-process cron approach avoids needing a second Fly Machine. If
the process is idle when the cron fires it'll wake up briefly, which
is fine on Fly (auto-stop is per-machine, not per-request).

## 8. Rate limiting

`web-hosting-plan.md` §11 covers this. Restate: in-process token
bucket keyed by `user.id` for `POST/PATCH/DELETE /api/*`. Single-node
deploy makes memory state fine. Starting numbers:

- 60 writes/min per user
- 600 writes/hour per user

**Plus the auth surface** (which wasn't in the original plan because
auth didn't exist yet):
- `/api/auth/register`: 5/hour per IP (prevents mass-signup).
- `/api/auth/verify-email`: already has 5-attempts + 60s resend cooldown
  in-DB; add a 20/hour per IP cap on top so a botnet can't sweep codes
  for known emails.
- `/api/auth/forgot-password`: 5/hour per IP + already has 60s per-user
  cooldown.
- `/api/auth/reset-password`: 10/hour per IP.
- `/api/auth/callback/credentials` (login attempts): 10/min per IP.

`@upstash/ratelimit` is the usual choice but it needs Redis. For a
single Fly machine, a tiny in-memory bucket is fine — LRU-cap the map
at 10k keys so it doesn't grow forever.

## 9. Monitoring

Minimum viable:
- `flyctl logs` in a terminal window during launch week.
- Fly's built-in metrics UI (CPU / memory / disk / network) — free.

Nice to have (defer until something actually breaks):
- **Sentry** for exceptions. Free tier is 5k events/mo. `pnpm add
  @sentry/nextjs`, `npx @sentry/wizard`, done.
- **BetterStack / Axiom** for structured log search if `flyctl logs`
  scrolling gets painful.

Not needed at this scale: APM, distributed tracing, on-call rotation.

## 10. Cost estimate

- Fly Machine (shared-cpu-1x, 1 GB, ~50% idle): **~$3-4/mo**
- Fly volume (3 GB): **~$0.45/mo**
- Fly Tigris (backups, ~100 MB retained): **~$0.10/mo**
- Resend free tier (up to 3k/mo emails, 100/day): **$0**
- Domain (Cloudflare `.app`): **~$14/yr → ~$1.20/mo**

**Total ~$5-6/mo** for the first ~500 users. Doubles at that point if
the machine starts thrashing memory (bump to `performance-1x`).

## 11. Runbook (first deploy)

Assumes you've completed [`checklist.md`](./checklist.md) Sections A-B
first (legal pages + Resend account).

```
# 1. Container works locally
docker build -t notomorrow-web -f apps/web/Dockerfile .
docker run --rm -p 3000:3000 -e ... notomorrow-web
# open http://localhost:3000, sign up, verify — sanity

# 2. Fly setup
flyctl auth signup   # or flyctl auth login
flyctl launch --no-deploy   # generates fly.toml, pick region + name
flyctl volumes create notomorrow_data --size 3 --region <region>

# 3. Secrets
flyctl secrets set \
  AUTH_SECRET=$(openssl rand -hex 32) \
  RESEND_API_KEY=re_... \
  MAIL_FROM=noreply@<yourdomain>

# 4. Deploy
flyctl deploy

# 5. Smoke
open https://<appname>.fly.dev
# register with a real email, get the code in inbox, verify, sign in

# 6. Domain (later, when DNS is ready)
flyctl certs create <yourdomain>
```

## 12. Rollback

- **Bad deploy:** `flyctl releases rollback` reverts to the previous
  image. Volume is untouched.
- **Bad migration:** all migrations are additive so far — no data loss
  from re-running an old image. If a future migration is destructive,
  add a `snapshot-before-migrate` hook to the entrypoint script.
- **Bad code past migration:** restore the SQLite file from a Tigris
  backup and redeploy the previous image.

## 13. What still isn't in this plan

- **Custom email templates.** Right now `mailer.ts` sends plain text.
  Fine for v1. HTML templates are a nice-to-have once you know the
  copy holds up.
- **Waitlist / gated signup.** Not needed for a free soft launch.
  Trivial to add later (a single env flag that makes register 403 for
  emails not in a `waitlist` table).
- **Password rotation on suspicious activity.** Skipped for v1.
- **Multi-region reads.** Single-node SQLite doesn't support this.
  Only relevant if you outgrow one machine — then you're switching to
  Postgres anyway.
