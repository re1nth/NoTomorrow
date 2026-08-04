# Release plan — NoTomorrow web (v1 launch)

The plan for taking the cloud-mode web app (`NOTOMORROW_AUTH=cloud`)
from "works on localhost" to "hosted at a URL that a stranger can sign
up on."

**Locked decisions (from the launch prep conversation):**

| Question | Answer |
| --- | --- |
| Pricing | Free during launch. Stripe deferred. |
| Character art | Ship as-is (Ippo sprites in `apps/web/public/stickers/`), accept the IP risk, plan hedges. See [`asset-ip.md`](./asset-ip.md). |
| Host | Fly.io Machines. Single machine + volume. Matches [`../web-hosting-plan.md`](../web-hosting-plan.md) Section 3. |
| Auth | Email + password (Auth.js Credentials provider). Already shipped in `main`. |
| Email delivery | Resend, 3k/mo free tier. See [`hosting.md`](./hosting.md#3-email-delivery). |

The rest of the plan derives from these four choices. Anything not
locked shows up as **TBD** and is called out below.

## Documents

1. [`hosting.md`](./hosting.md) — Fly deploy, Dockerfile,
   entrypoint, DNS + TLS, secrets, email provider, backups, monitoring,
   rate limiting, health check.
2. [`onboarding-ux.md`](./onboarding-ux.md) — landing copy,
   post-signup empty states, activation loop, legal pages, welcome
   email.
3. [`asset-ip.md`](./asset-ip.md) — the Ippo-sprite copyright
   risk, realistic outcomes, hedges that keep the "swap art later"
   door open.
4. [`checklist.md`](./checklist.md) — the actionable, ordered
   punch-list. Print this out and tick things off.

## TBDs

- **Domain name.** No suggestion in-repo. Cheap options: `.app` on
  Cloudflare (~$14/yr), `.dev` (~$12/yr), `.xyz` (~$1/yr). Needed
  before DNS + TLS steps, but not before Fly deploy — the app will
  respond on `notomorrow.fly.dev` in the meantime.
- **Fly account owner.** Whoever owns it holds the credit card + can
  rotate `AUTH_SECRET`. Same for the Resend account.
- **Support email address.** Needs to exist for the privacy policy
  ("questions? contact ...").
- **Sending domain for Resend.** If you use your own domain (e.g.
  `hello@notomorrow.xyz`) you need SPF/DKIM records — 5 min work. If
  you use `onboarding@resend.dev` you skip that but users see the
  Resend sender in their inbox.

## Rough timeline

The whole thing is 1-2 focused weekends of work if you don't hit
snags on DNS or the container build. Order per [`checklist.md`](./checklist.md).

| Phase | What lands | Rough effort |
| --- | --- | --- |
| A. Legal pages | privacy + terms in-repo | 1 hr |
| B. Email provider | Resend account, mailer swap, verify a real send | 2 hr |
| C. Container | Dockerfile, entrypoint, local `docker run` boots | 3-4 hr |
| D. Deploy | fly.toml, volume, secrets, first prod deploy | 2 hr |
| E. Domain | buy, DNS to Fly, TLS auto-issued | 1 hr |
| F. UX polish | landing copy, empty state, footer, welcome email | 3 hr |
| G. Ops | backups cron, rate limit, health check, log tail | 3 hr |
| H. Soft-launch | invite 5 friends, watch logs, fix anything obvious | ongoing |

## Success criteria for v1

A stranger with only the URL can:

1. Land on the marketing page and understand what the product does in
   under 5 seconds.
2. Sign up with email + password, verify via emailed code, and land on
   an empty `/counters` that tells them what to do next.
3. Create their first counter and see it check in.
4. Sign out and back in on the same device.
5. Recover access if they forget their password.

Everything already works end-to-end on localhost (verified in prior
Playwright runs). The plan is entirely about the seam between "works
locally" and "works when a stranger types the URL."
