# 04 — Frontend

## Stack

- **Next.js 15** (App Router, React Server Components) + **React 19** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** as the base component layer
- **Framer Motion** for transitions; **Lottie** for anime-style keyframe sequences
  (punch impacts, KO stamp, bell ring)
- **TanStack Query** for server state; **Zustand** for ephemeral UI state
- **next-auth** (Clerk acceptable alternative)
- **SSE** for streaming coach responses (roadmap generation, chat)

## Key surfaces

1. **The Gym (Home)** — dojo backdrop, today's training card, coach's latest
   message, streak counter rendered as wrapped hand bandages.
2. **Goal Creator** — chat-driven. User describes ambition, picks horizon and
   domain. Roadmap streams in as a visual DAG.
3. **Roadmap View** — boxing-ring-shaped board: rounds as corners, current
   milestone glowing, completed rounds stamped KO.
4. **Round View** — milestone detail; tasks listed as punches with icons; proof
   submission inline.
5. **Sparring Session** — daily standup modal: "Show me what you got." Logs to
   TrainingLog.
6. **Rating Dashboard** — Stamina/Expertise sparklines, recent RatingEvents
   rendered as a fight history.
7. **Rivals** — leaderboard of users with similar goals, archetyped as Hajime
   characters (Miyata/Sendo/Volg). Head-to-head streaks.
8. **Bundle Marketplace** — fork someone's completed roadmap as your starting
   point.

## Theme system

Custom Tailwind theme `theme-ippo`:

- Ring-canvas off-white background
- Glove-red accents
- Charcoal blacks
- Neon "KO" yellow for celebrations

Optional, toggleable sound effects: bell at round start, glove impact on task
completion. Default off; opt-in during onboarding so the app doesn't ambush
people in offices.

## Animation budget

Animations carry meaning, not decoration:

- **KO stamp** — only on milestone clear
- **Bell** — round start / new milestone unlock
- **Punch swoosh** — task verified
- **Counter punch** — coach feedback on failed proof
- **Down for the count** — streak broken

Anything else is restraint. The theme is the hook; if every interaction punches
the screen, it becomes a toy and serious builders bounce.

## Accessibility notes

- All sound effects opt-in
- Lottie animations respect `prefers-reduced-motion`
- Coach voice/tone toggle: intense / encouraging / quiet (same content, different
  copy register)
