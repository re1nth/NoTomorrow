# packages/ui — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

**Wave 0.** Independent; can start in parallel with `domain` and `prompts`.

## Mission

Shared visual layer for the product: Hajime no Ippo–themed Tailwind preset,
base React components, and Lottie animation assets.

## Scope

**In:**
- Tailwind preset `theme-ippo` (colors, typography, spacing scale, motion tokens)
- Base components: `Button`, `Card`, `KOStamp`, `BellRing`, `RoundDial`,
  `RatingSparkline`, `CoachBubble`, `PunchIcon`, `StreakBandage`
- Lottie animation JSON: KO stamp, bell ring, punch swoosh, down-for-the-count,
  counter-punch
- Sound asset stubs (placeholder files; real audio sourced later)
- Storybook for visual review

**Out:**
- Page-specific compositions (live in `apps/web`)
- App-level routing, data fetching, auth
- Marketing components (deferred)

## Dependencies (consumes)

- Peer: `react`, `react-dom`, `tailwindcss`, `framer-motion`, `lottie-react`
- Theme guidance: [arch/04-frontend.md](../../arch/04-frontend.md)

## Exposes

- `import { Button, Card, KOStamp, ... } from '@notomorrow/ui'`
- Tailwind preset: `import preset from '@notomorrow/ui/tailwind'`
- Lottie JSON: `import koStamp from '@notomorrow/ui/lottie/ko-stamp.json'`

## Build steps (ordered)

1. `package.json` with peer deps
2. `tailwind.preset.ts` with `theme-ippo` palette (ring-canvas off-white,
   glove-red, charcoal, KO yellow)
3. Typography scale + motion tokens (durations, easings) in preset
4. `components/Button.tsx` first as the pattern (variants + size + theme tokens)
5. `components/KOStamp.tsx` + Lottie wrapper
6. Remaining components in priority order: `Card`, `CoachBubble`, `PunchIcon`,
   `RoundDial`, `RatingSparkline`, `BellRing`, `StreakBandage`
7. Source / commission Lottie JSON (placeholder hand-drawn first pass is fine)
8. Storybook setup with one story per component
9. Build script that emits `dist/` with type declarations

## Acceptance criteria

- [ ] All listed components render in Storybook with at least one story
- [ ] Tailwind preset consumable from `apps/web` (test import in a stub Next.js
      page)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] All sound triggers are gated behind a `sound` prop, default off
- [ ] `pnpm typecheck` passes
- [ ] Components have no app-specific logic (no fetching, no router imports)

## Verification

```
pnpm --filter @notomorrow/ui storybook
pnpm --filter @notomorrow/ui build
```

## Deferred / out of scope

- Dark mode variants (post-MVP)
- Real licensed sound effects
- Marketing-only components

## Open questions

- Lottie source: hand-make vs commission vs license? Decide before Storybook
  fills out — affects component API for animation customization.
- Component API for sound: prop on each component or global `<SoundProvider>`?

## Coordination

- This is the only package owning aesthetic decisions. `apps/web` must not
  redefine theme colors locally.
- If you add a new component, register it in this PLAN's component list and the
  TRACKER interface contract.
