/**
 * Static 10-question diagnostic for the MVP starting domain `web-frontend`.
 *
 * Decision recorded in PLAN: "fetch a full set up front to avoid per-question
 * latency". The score (0..10) seeds the initial Expertise rating below the
 * 1200 baseline so daily wins move the needle visibly.
 */

export interface DiagnosticQuestion {
  id: string;
  prompt: string;
  choices: { id: string; label: string; weight: number }[];
}

export const WEB_FRONTEND_DIAGNOSTIC: DiagnosticQuestion[] = [
  {
    id: 'q1',
    prompt: 'How many production sites have you shipped end-to-end?',
    choices: [
      { id: 'a', label: '0 — never deployed anything', weight: 0 },
      { id: 'b', label: '1–2 small projects', weight: 1 },
      { id: 'c', label: '3+ projects, some with real users', weight: 2 },
    ],
  },
  {
    id: 'q2',
    prompt: 'How comfortable are you with modern JavaScript / TypeScript?',
    choices: [
      { id: 'a', label: 'Haven’t written either', weight: 0 },
      { id: 'b', label: 'Can read it, struggle to write it', weight: 1 },
      { id: 'c', label: 'Writing TS daily', weight: 2 },
    ],
  },
  {
    id: 'q3',
    prompt: 'CSS layout — flexbox + grid?',
    choices: [
      { id: 'a', label: 'Copy-paste from Stack Overflow', weight: 0 },
      { id: 'b', label: 'Reach for it confidently', weight: 1 },
      { id: 'c', label: 'Can debug others’ layouts on sight', weight: 2 },
    ],
  },
  {
    id: 'q4',
    prompt: 'React / Vue / Svelte component model?',
    choices: [
      { id: 'a', label: 'Brand new', weight: 0 },
      { id: 'b', label: 'Built a few apps', weight: 1 },
      { id: 'c', label: 'Comfortable with hooks/composition + state libs', weight: 2 },
    ],
  },
  {
    id: 'q5',
    prompt: 'Have you used a meta-framework like Next.js or Nuxt?',
    choices: [
      { id: 'a', label: 'No', weight: 0 },
      { id: 'b', label: 'Tried tutorials', weight: 1 },
      { id: 'c', label: 'Shipped a real app on one', weight: 2 },
    ],
  },
  {
    id: 'q6',
    prompt: 'Comfort with browser DevTools (network, performance, sources)?',
    choices: [
      { id: 'a', label: 'Console.log is enough', weight: 0 },
      { id: 'b', label: 'Use Network + Elements regularly', weight: 1 },
      { id: 'c', label: 'Profile + debug perf issues', weight: 2 },
    ],
  },
  {
    id: 'q7',
    prompt: 'Accessibility (a11y) — color contrast, ARIA, keyboard nav?',
    choices: [
      { id: 'a', label: 'Haven’t thought about it', weight: 0 },
      { id: 'b', label: 'Aware, occasionally test', weight: 1 },
      { id: 'c', label: 'Ship to WCAG AA habitually', weight: 2 },
    ],
  },
  {
    id: 'q8',
    prompt: 'Deployment — can you put a Next.js app on the internet by tomorrow?',
    choices: [
      { id: 'a', label: 'No idea where to start', weight: 0 },
      { id: 'b', label: 'With docs in front of me', weight: 1 },
      { id: 'c', label: 'Yes, from memory', weight: 2 },
    ],
  },
  {
    id: 'q9',
    prompt: 'Testing front-end code (unit + integration)?',
    choices: [
      { id: 'a', label: 'I don’t test', weight: 0 },
      { id: 'b', label: 'Some unit tests', weight: 1 },
      { id: 'c', label: 'Cypress / Playwright in CI', weight: 2 },
    ],
  },
  {
    id: 'q10',
    prompt: 'How motivated are you, on a scale of 1–5, to ship in the next 30 days?',
    choices: [
      { id: 'a', label: '1–2 (exploratory)', weight: 0 },
      { id: 'b', label: '3 (curious)', weight: 1 },
      { id: 'c', label: '4–5 (already pacing the gym)', weight: 2 },
    ],
  },
];

export function scoreDiagnostic(answers: Record<string, string>): number {
  let total = 0;
  for (const q of WEB_FRONTEND_DIAGNOSTIC) {
    const chosen = q.choices.find((c) => c.id === answers[q.id]);
    if (chosen) total += chosen.weight;
  }
  return total; // 0..20
}

export function ratingFromScore(score: number): { stamina: number; expertise: number } {
  // Map a 0..20 raw score to a +/-100 delta around the 1200 baseline.
  const delta = Math.round(((score - 10) / 10) * 100);
  return { stamina: 1200 + delta, expertise: 1200 + delta };
}
