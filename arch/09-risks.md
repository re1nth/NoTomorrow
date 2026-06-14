# 09 — Risks & Open Questions

Risks are things we know could hurt. Open questions are decisions we're
deferring. Move resolved ones into the appropriate doc and note the change in
[CHANGELOG.md](./CHANGELOG.md).

## Risks

### Roadmap quality
Bad roadmaps kill trust on day one. A first-time user who gets a generic plan
will never come back. **Mitigation:** 50-prompt eval suite before launch; review
first 100 real roadmaps manually.

### Proof grading false positives
Easier to be too lenient than too strict — LLMs want to be agreeable. A user
whose rating climbs from junk proofs will sense the system is hollow.
**Mitigation:** calibrate against a manually-graded set; bias the grading
prompt toward strictness with explicit examples of "looks like work but isn't."

### Theme overreach
Hajime aesthetic is the hook, but if it makes the app feel like a toy, serious
builders bounce. **Mitigation:** keep core flows clean; concentrate flavor in
transitions and empty states (see animation budget in [04-frontend.md](./04-frontend.md)).

### LLM cost per active user
Daily Haiku messages + weekly Opus replans is roughly $0.20–0.50 per MAU.
Without prompt caching it's 5–10x that. **Mitigation:** caching is non-optional
on the persona + profile blocks.

### Coach voice drift
If we tune the persona over time, existing users might feel "their coach
changed." **Mitigation:** version coach personas; users keep their original
unless they opt into a new one.

### Cold start with no rivals
The rivals/leaderboard feature is hollow until there's a population. Don't ship
it as a first impression in MVP.

## Open questions

### Domain taxonomy
Should domains be a fixed list (e.g. `web-frontend`, `backend`, `ml`,
`devops`...) or user-defined tags? Fixed taxonomy = clean rating comparisons.
Free tags = matches the "bundle anything you want" pillar. Probably: fixed
parent domains with user-defined sub-tags.

### Combined "overall" rating
Show one combined number on the leaderboard, or only per-domain? Combined
incentivizes broad showing-up (good); also incentivizes gaming low-bar domains
(bad). Lean: per-domain only, with "active domains" count as a secondary signal.

### Multiplayer
Are rivals purely a leaderboard, or can two users formally challenge each other
on a shared goal? The latter is closer to the anime spirit but adds significant
product surface.

### Coach voice modes
Three intensity modes (intense / encouraging / quiet) were sketched in
[04-frontend.md](./04-frontend.md). Open: do we let users switch mid-goal, or
is it set once at onboarding?

### Bundle moderation
Once bundles are public, we need a report flow. What's the threshold for auto-
hiding? Who reviews?

### Pricing
Not addressed yet. Open questions: free tier shape, whether coach throughput
(daily messages, recalibrations) is the natural metered axis.

### Mobile
Web-first is the default. Native mobile is deferred but the daily-check-in
ritual is the kind of thing that needs a phone push. Open: PWA push as a
middle path.
