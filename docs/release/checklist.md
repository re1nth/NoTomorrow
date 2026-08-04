# Launch checklist

Everything needed to get from `main` today to a stranger typing a URL
and using the product. Ordered by dependency — do the earlier things
first, they unblock later ones. Each line is small enough to knock out
in one sitting.

## A. Legal + admin (do first, blocks D)

- [ ] Pick a domain name. Register it (Cloudflare / Namecheap). Cost:
      $1-$14/yr.
- [ ] Decide on a support email address (e.g. `hello@yourdomain`).
      Configure the DNS `MX` records or forward to your personal inbox.
- [ ] Draft `apps/web/app/(marketing)/privacy/page.tsx` using
      [termly.io's generator](https://termly.io/products/privacy-policy-generator/).
- [ ] Draft `apps/web/app/(marketing)/terms/page.tsx` same way.
- [ ] Add a footer with `Privacy · Terms · Contact` to `app/layout.tsx`.

## B. Email provider (blocks D)

- [ ] Sign up at [resend.com](https://resend.com). Verify your
      account.
- [ ] Generate an API key. Save it — you'll set it as a Fly secret
      later.
- [ ] Either verify a sending domain (add SPF+DKIM DNS records; ~5
      min) **or** decide to use `onboarding@resend.dev` for launch
      week.
- [ ] Update `apps/web/lib/mailer.ts` to call Resend when
      `RESEND_API_KEY` is set, log-only otherwise. Code sketch in
      [`hosting.md` §3](./hosting.md#3-email-delivery).
- [ ] `pnpm --filter web add resend`.
- [ ] Local test: `RESEND_API_KEY=... pnpm --filter web dev`, sign up
      with your own email, confirm the code arrives in your inbox.

## C. Asset IP hedges (do before deploying publicly)

- [ ] Refactor stickers behind `apps/web/lib/sticker-map.ts`. See
      [`asset-ip.md` §Hedge 3](./asset-ip.md#hedge-3--swap-friendly-component-boundary).
- [ ] Set `og:image` on landing to a text-forward card (not the Ippo
      sprite). See [`asset-ip.md` §Hedge 1](./asset-ip.md#hedge-1--keep-the-sprite-off-social-preview).
- [ ] Add `Disallow: /stickers/` to `apps/web/public/robots.txt`.
- [ ] Write the DMCA response runbook on your desktop.

## D. Container (blocks E)

- [ ] Enable `output: 'standalone'` in `apps/web/next.config.ts`.
- [ ] Write `apps/web/Dockerfile` (multi-stage, per
      [`hosting.md` §2](./hosting.md#2-container-image)).
- [ ] Write `apps/web/docker-entrypoint.sh` — runs migrations then
      `exec node server.js`.
- [ ] Write `packages/db-sqlite/run-migrations.mjs` (or reuse the
      migration snippet from `apps/web/README.md`) inside the image.
- [ ] Write `apps/web/.dockerignore`.
- [ ] Local smoke: `docker build`, `docker run`, register + verify
      against a temp volume. Command in [`hosting.md` §2](./hosting.md#2-container-image).

## E. Deploy (blocks F, G, H)

- [ ] `flyctl auth signup` or `flyctl auth login`.
- [ ] `flyctl launch --no-deploy`. Pick region closest to your target
      users. Pick app name. Don't accept the auto-generated Postgres —
      we're using SQLite on a volume.
- [ ] `flyctl volumes create notomorrow_data --size 3 --region <region>`.
- [ ] Set secrets:
      ```
      flyctl secrets set \
        AUTH_SECRET=$(openssl rand -hex 32) \
        RESEND_API_KEY=re_... \
        MAIL_FROM=noreply@<yourdomain>
      ```
- [ ] Add `apps/web/app/api/health/route.ts` returning `{ ok: true }`.
- [ ] Configure `fly.toml`:
      - `[env]` block with `NOTOMORROW_AUTH=cloud`,
        `AUTH_TRUST_HOST=true`, `SQLITE_DB_PATH=/data/notomorrow.db`.
      - Volume mount `/data`.
      - HTTP check `/api/health`.
- [ ] `flyctl deploy`. Watch the logs.
- [ ] Open `https://<appname>.fly.dev`. Register with a real email.
      Verify. Sign in. Create a counter. Sign out. Sign back in. Reset
      password. Confirm each email arrives.

## F. Domain (unblocks the "real" URL)

- [ ] Add DNS `A` + `AAAA` records for the apex domain pointing at
      Fly's IPs (`flyctl ips list`).
- [ ] `flyctl certs create <yourdomain>`. Wait for cert to issue.
- [ ] Repeat for `www.<yourdomain>` if desired.
- [ ] Update `AUTH_URL` (or equivalent) if hard-coded anywhere.
- [ ] Update Resend `MAIL_FROM` to your domain if you verified one.

## G. UX polish

- [ ] Add product-explaining subtitle + feature strip to
      `LandingHero`. See [`onboarding-ux.md` §1](./onboarding-ux.md#1-landing-page-).
- [ ] Add starter-thread suggestions to the empty `/counters` state.
      See [`onboarding-ux.md` §3](./onboarding-ux.md#3-first-run-empty-state-counters).
- [ ] Send welcome email from the successful-verify path. See
      [`onboarding-ux.md` §5](./onboarding-ux.md#5-welcome-email).
- [ ] Add "check spam" hint under the verify-email code input.
- [ ] Add "Change password" form to `/settings`.
- [ ] Confirm delete-account cascade + immediate sign-out work.

## H. Ops

- [ ] Nightly SQLite backup cron job. See
      [`hosting.md` §7](./hosting.md#7-backups).
- [ ] Rate limiter middleware. See
      [`hosting.md` §8](./hosting.md#8-rate-limiting).
- [ ] Watch `flyctl logs` in a terminal during launch week.
- [ ] Nightly log line: `[stats] users=N counters=M
      checkins_today=X`. See [`onboarding-ux.md` §9](./onboarding-ux.md#9-analytics--skip-for-v1).

## I. Soft-launch

- [ ] Sign yourself up on the live URL. Poke everything. Fix what's
      broken.
- [ ] Invite 3-5 friends. Ask them to try it without any tutoring.
      Watch what confuses them.
- [ ] Fix the top 3 issues. Deploy.
- [ ] Wait a week. Look at activation (§10 of onboarding-ux). Iterate.
- [ ] Post it somewhere (Show HN, personal blog, whatever) once you're
      confident it holds up under 100 concurrent signups.

## Order-of-operations tips

- **A + B are cheap and unblock everything else.** Get them out of
  the way in one evening.
- **C, D, and G can go in parallel** across days — they don't touch
  each other.
- **E is the pucker moment.** Set aside 2 uninterrupted hours the
  first time — most of it is waiting for `flyctl deploy` to build and
  volume+cert steps to succeed. Nothing hard, just ~5 things that
  each take 5 min.
- **F unblocks nothing product-wise** — the Fly `.fly.dev` URL is
  fine for the whole launch week. Do it when you have DNS patience.
- **H is safety-net work.** Don't block launch on it, but don't skip
  either — a backup you never take is worse than no backup at all
  because you assume you have one.

## What "done" looks like

You can send this list of URLs to someone with only these
instructions:

> Sign up at https://<yourdomain>. Verify the emailed code. Create a
> thread called "10 pushups." Check it in every day.

...and they complete the flow without asking you anything.

That's launch.
