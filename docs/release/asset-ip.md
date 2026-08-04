# Asset IP audit — the Ippo sprite question

## What's in the tree

`apps/web/public/stickers/` contains ten PNGs used as visual accents
across the app:

| File | What it depicts |
| --- | --- |
| `champion.png` | Ippo Makunouchi in a boxing pose on the ring (landing hero) |
| `orange.png` | Ippo in a right cross pose |
| `black.png` | Ippo in a defensive stance |
| `black-ii.png` | Ippo, dukes up |
| `black-iii.png` | Ippo, cornered/blocking pose |
| `blue.png`, `brown.png`, `green.png`, `white.png`, `yellow.png` | Ippo in various boxing stances, color-coded to belt tiers |

These are **Ippo Makunouchi** from the manga/anime **Hajime no Ippo**,
created by George Morikawa. Copyright is held by Morikawa and
published by **Kodansha** in Japan.

The images look like frame captures or fan-made pixel art derived from
the anime. Either way, they are **derivative works of a copyrighted
character**.

## Where they render

- `components/LandingHero.tsx:113` — `champion.png` on the marketing
  home page (`/`). Publicly visible without auth.
- `app/(app)/counters/belts.ts` — the other stickers used inside the
  authenticated app, mapped to belt colors on the Counters cards.

The landing page render is the higher-risk surface because it's
publicly indexable. The in-app stickers require an account to see, so
they're only visible to logged-in users.

## Legal reality (plain talk, not legal advice)

**Yes, this is copyright infringement.** Reproducing and publicly
distributing a copyrighted character on a hosted service — commercial
or not — is technically a violation of the copyright holder's
exclusive rights. This is true whether:

- The service is free (you don't have to profit for it to infringe).
- The image is small / low-resolution.
- You credit the creator.
- The service is niche.
- The character is "beloved by fans."

Fair use is a defense, not a right, and this use doesn't cleanly fit
any of the four factors (character is the whole point, not
commentary or parody).

## What could happen — ordered by likelihood

1. **Nothing.** Most likely outcome for a small-scale launch (<1000
   users). Kodansha and Morikawa don't run a hair-trigger DMCA
   operation for every fan project. Enforcement is patchy.
2. **A polite DMCA takedown.** Fly, Cloudflare, and most infra
   providers will forward a DMCA notice to you and require you to
   respond within ~10 days. Comply → images removed, site keeps
   running.
3. **Account suspension by the hosting provider.** If you ignore a
   takedown or infringe repeatedly, Fly can suspend the whole app.
4. **A cease-and-desist from Kodansha's legal team.** Rare for a small
   personal project. More common if you (a) monetize, (b) grow
   noticeably visible, (c) put the character in advertising, (d) get
   picked up by press.
5. **A lawsuit.** Vanishingly rare for a hobbyist scale. Statutory
   damages in the US can run $750-$30,000 per infringed work; up to
   $150k for willful. But suing a solo dev over a habit tracker is
   bad optics and expensive for the rights holder, so it almost never
   happens.

The realistic threat is (2). The site goes down for a few hours while
you swap art. Not catastrophic. But **the threat scales with visibility**
— the moment you show up on Hacker News, Reddit r/manga, or anywhere
Japanese fans might see it, risk jumps.

## Decision: ship as-is, with hedges

Given the goal of a small free launch to test the product, the
practical choice is to ship the current art and prepare to swap it
under pressure. That's fine, provided you do the following hedges so
"pull it if needed" is a 30-minute change, not a rewrite.

### Hedge 1 — keep the sprite off social preview

The `<meta property="og:image">` on the landing page determines what
gets embedded when someone shares the URL on Twitter/Slack/Reddit.
**Do not** set `og:image` to `champion.png`. Use a text-forward
og-image instead (either an SVG of the "NO TOMORROW" wordmark, or a
generated card with the tagline). Same for `twitter:image`.

Why: image search + social crawlers index og-images heavily. The
sprite existing in the site is one risk; the sprite being the
"business card" of the site on every share is a much bigger risk.

**Check:** `apps/web/app/layout.tsx` metadata + any per-page metadata
on `app/page.tsx`.

### Hedge 2 — no `robots.txt` allow for the stickers folder

Add to `apps/web/public/robots.txt`:
```
User-agent: *
Disallow: /stickers/
```
Search engine bots (including Google Images) still respect this
almost universally. The image URLs still resolve for real users;
they just don't get indexed. Reduces search-discovery risk.

### Hedge 3 — swap-friendly component boundary

All sticker references go through a single indirection so a future
swap doesn't touch every callsite. Introduce
`apps/web/lib/sticker-map.ts`:

```ts
export const stickers = {
  champion: '/stickers/champion.png',
  belt: {
    white: '/stickers/white.png',
    yellow: '/stickers/yellow.png',
    // ...
  },
} as const;
```

Every current import that hardcodes `/stickers/foo.png` gets updated
to reference `stickers.champion` / `stickers.belt.yellow`. Then, if
you swap the art later (commissioned or CC0), one file change points
the whole app at the new set.

**~1 hour of refactor. Do it before launch.**

### Hedge 4 — DMCA response readiness

Have a plan you can execute in 30 minutes:

1. Replace the 10 files in `public/stickers/` with 1×1 transparent
   PNGs (or better, temporary placeholder art).
2. `flyctl deploy`.
3. Reply to the DMCA notice confirming removal.

Keep a text file — literally on your desktop — with:
- The Fly app name
- The redeploy command
- The email template for the DMCA response

If it happens, you're 30 minutes from clean. Panic-free.

### Hedge 5 — don't add more infringing content

The current 10 stickers are the exposure. Don't grow it. If you add
new visual accents (e.g. animated GIFs, avatars), source them from:
- **CC0 pixel art:** [OpenGameArt](https://opengameart.org),
  [itch.io game asset section](https://itch.io/game-assets/free) —
  filter to CC0 license.
- **Original commission:** ~$100-500 on Fiverr for a small sprite
  set. Pixel-art boxing sprites are a common brief.
- **Your own art.** Nothing beats owning it outright.

## The real remediation (later)

When the app has enough users that DMCA risk feels real (subjective
threshold — maybe 500 users, or the first blog post that mentions it,
or the day you decide to charge for it), do the full swap:

1. Commission a pixel-art set of a generic "boxer training" character
   — jumping rope, bag work, shadowboxing, sparring. Same
   anime-brawler aesthetic, not any specific character.
2. Replace `public/stickers/*.png`. Because of Hedge 3, no other file
   changes.
3. Ship.

Budget: 1-2 weeks lead time + $200-500. Do this the moment the
app starts feeling like a real product rather than a personal side
project.

## Also worth checking

Not the sticker set, but audit-adjacent:

- **Font.** The "NO TOMORROW" wordmark uses a display font. Check
  `packages/ui/src/tailwind.preset.ts` and `app/layout.tsx` for the
  font name. If it's a Google Font or SIL OFL font, you're fine. If
  it's a commercial font (Monotype, Adobe, etc.) with a desktop-only
  license, you need a web license — usually a few hundred dollars/yr.
- **Lottie animations.** `packages/ui/src/lottie/*.json` — verify
  these are either original or from LottieFiles' free/CC0 pool.
- **Icon set.** If any icons come from a paid pack (Font Awesome Pro,
  Nucleo, etc.), check the license covers web distribution.

Time-box this audit to an hour. Fonts and icon licenses are usually
either "clearly free" or "clearly paid" — no ambiguity.

## TL;DR

- Ship as-is is a defensible call for a small free launch.
- Do the four hedges before you deploy: no og-image, robots.txt
  disallow, sticker-map indirection, DMCA runbook.
- Do the real art swap when the app grows past "personal project."
- The art swap is one file change if you did Hedge 3.
