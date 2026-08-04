# Onboarding UX — what a stranger sees on launch day

The auth flow works. The gap now is between "signed up" and "using the
product." A first-time user currently lands on an empty `/counters`
page with a `+ NEW THREAD` button and no explanation of what a
"thread" is or why they'd want one. This doc covers the polish that
turns that into a real product experience.

## 1. Landing page (`/`)

Current state: signed-out visitors see `LandingHero` (the Ippo sprite +
"NO TOMORROW" wordmark + "Step into the ring" CTA). It's atmospheric
but says nothing about what the product does. A stranger has no idea
whether this is a game, a music album, or a habit tracker.

Add above the CTA:

- **A one-liner subtitle** under the wordmark. Draft:
  > *One thread. One punch a day. Don't break the chain.*
  (Already used on `/counters`. Move it to the landing.)
- **Three-bullet feature strip** below the CTA, one line each:
  - **Track daily.** Any habit — one tap, once a day.
  - **Watch the chain grow.** Streaks, heatmaps, colored belts.
  - **Focus with a Pomodoro.** Menu-bar timer built in.
- **A screenshot** of the counters page with a real-looking heatmap.
  There's already one at `docs/home.png` — reuse it.

Keep the atmosphere. The visual identity is a strength; the copy just
has to catch up. Don't sanitize the aesthetic.

## 2. Sign-up flow polish

Already works. Two rough edges:

- **Verification code confusion when mail is delayed.** Users may hit
  "Verify" before the code arrives. Add a subtle "usually arrives
  within 30 seconds — check spam" hint under the code input.
- **What happens if they close the tab.** Right now, if they close
  `/verify-email` and come back later, they have to remember the URL.
  Fix: signing in with correct credentials on an unverified account
  already redirects to `/verify-email` (shipped in `82897b0`), so
  they just sign in again. Mention this on the verify page itself
  ("Left this tab? Sign in later and we'll bring you back here.").

## 3. First-run empty state (`/counters`)

Blocking gap. Current empty state is *literally empty* — a header, a
subtitle, an empty grid, and the `+ NEW THREAD` button in the corner.

Replace with an inline explainer + starter suggestions:

```
[ empty grid area ]

You don't have any threads yet.

A "thread" is anything you want to do daily. Pushups. Practicing
guitar. Journaling. Whatever needs a chain to hold together.

Pick something to start:

  [+ Add "Read for 20 minutes"]
  [+ Add "10 pushups"]
  [+ Add "Write one paragraph"]
  [+ Add my own thread]
```

The first three are one-click creations. The last opens the current
`+ NEW THREAD` dialog. Server-side this is just three preset names
passed to the existing `POST /api/counters`.

Rationale: the hardest part of a habit tracker isn't the tracking, it's
picking a habit. Reducing that to one click on day zero is the single
highest-leverage change in the onboarding funnel.

## 4. Post-first-checkin nudge

After the user checks in for the first time, show a one-off toast:

> Nice. Come back tomorrow to keep the chain alive.

Store the "shown once" flag in localStorage. Don't show it again.

## 5. Welcome email

Currently we send: verification code, password reset.

Add: a **welcome email** fired from the successful verify path, one
paragraph:

> Welcome to NoTomorrow.
>
> The app is at <URL>. Add a thread, tap it once a day, and watch the
> chain grow. Miss a day? Tap the empty cell on the heatmap to
> backfill.
>
> Questions or bugs? Reply to this email.
> — <name>

Two purposes: (1) confirms deliverability from the sender domain so
future emails have a warm-up signal; (2) sets expectations that this
is a human product with a real person on the other end.

Skip weekly digests / streak-loss warnings / re-engagement drips for
v1. Add them if activation data says people are dropping off.

## 6. Settings page (`/settings`)

Already exists. Verify these three do what the user expects:

- **Handle change.** Uniqueness check → success message. Handle appears
  in the URL or profile card somewhere so the change is visible.
- **Timezone change.** Auto-set from the browser at signup. Show
  current value + a dropdown. Should update the "today" boundary
  immediately.
- **Delete account.** The confirmation currently case-insensitively
  matches the handle (per commit `b3c9db0`). Verify the copy explains
  that check-ins and history are gone forever — cascade wipes them.

Add one thing:
- **Change password.** New form, requires current password + new
  password + zxcvbn score ≥ 2. Server-side: bcrypt-compare the old,
  bcrypt-hash the new. Small route.

## 7. Legal pages

**Blocking for launch.** Two markdown pages under
`apps/web/app/(marketing)/`:

- `privacy/page.tsx` — what data you collect (email, password hash,
  check-in history, IP address for rate limiting), how long you keep
  it, who you share it with (nobody), how to request deletion (delete
  account in settings, or email).
- `terms/page.tsx` — service is provided as-is, no warranty, you can
  ban abusers, you'll give 30 days notice before shutting down.

Do not hand-roll these from scratch. Base them on:
- https://termly.io/products/privacy-policy-generator/
- https://termly.io/products/terms-and-conditions-generator/

Or use a boilerplate off GitHub if you want to skip the marketing
funnel. Substance matters more than form here.

Footer on every page, small text: `Privacy · Terms · Contact`.

**Contact** just needs to be a `mailto:` link that works. Doesn't need
to be a form.

## 8. Deletion path

Verify:
- `DELETE /api/me` (already implemented) cascades and wipes
  `counters`, `counter_check_ins`, `perf_sessions`, `accounts`,
  `sessions`, `password_reset_tokens`, `email_verification_codes`
  through the FK cascades.
- User is signed out immediately after (client-side redirect to `/`).
- Their email is now free to re-register.

This satisfies the GDPR "right to erasure" and the CCPA "right to
delete" for a US audience without needing a formal DPO. Add a line in
the privacy policy: *"Delete your account in Settings; all data is
removed immediately."*

## 9. Analytics — skip for v1

Do not add Google Analytics or a session-recording tool for launch.

Reasons:
- Kills the privacy-friendly angle you get for free by having no
  trackers.
- You don't need cohort data to iterate on a product with <100 users;
  a `SELECT count(*) FROM users` and a manual look at the check-in
  heatmap tells you what you need.
- Adding it later is a five-minute change if you decide you want it.

If you want a single number, add a nightly log line:
```
[stats] users=N counters=M checkins_today=X
```

That's your dashboard.

## 10. Activation checklist (what "activated" means)

A user is **activated** when they:

1. Verified their email.
2. Created at least one counter.
3. Checked in on at least two distinct days.

That third one is the real signal — anyone can create a counter once,
but two days apart means they came back. Query:

```sql
SELECT COUNT(DISTINCT user_id)
FROM counter_check_ins
WHERE user_id IN (
  SELECT user_id FROM counter_check_ins
  GROUP BY user_id
  HAVING COUNT(DISTINCT day) >= 2
);
```

Track this manually for the first month. If it's less than ~30% of
verified signups, the empty-state onboarding (§3) needs more work.

## 11. Not doing for v1

Listed so future-you doesn't wonder if they were forgotten:

- Social login (Google/Apple/GitHub). Adds a second auth path,
  provider account, and merge logic. Not worth it for a v1 that
  already ships email/password.
- Passkeys. Same reasoning — cool, but shipping email/password is
  enough friction to smoke-test.
- Referral / share links.
- Team / shared threads.
- Public profile pages ("here's my streak").
- Mobile apps. The Electron desktop covers macOS; a PWA might cover
  mobile-web later.
- Payments. See [`README.md`](./README.md) — free during launch.
