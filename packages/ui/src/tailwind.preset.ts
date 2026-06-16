/**
 * theme-ippo — Tailwind preset for the NoTomorrow product.
 *
 * Palette and motion tokens derived from the Hajime no Ippo aesthetic:
 *  - ring-canvas off-white background
 *  - glove-red accents
 *  - charcoal blacks
 *  - neon KO yellow for celebrations
 *
 * Consumed by `apps/web` via:
 *   import preset from '@notomorrow/ui/tailwind';
 *   export default { presets: [preset], content: [...] };
 */

import type { Config } from 'tailwindcss';

/**
 * Motion tokens — surfaced as both CSS variables (via theme.extend) and as
 * plain JS exports so framer-motion components can pull canonical values.
 */
export const motionTokens = {
  durations: {
    /** Micro-interaction, button press, hover ack */
    instant: 0.12,
    /** Default transitions, card hover, modal fade */
    quick: 0.22,
    /** Punch swoosh, bell ring */
    punch: 0.38,
    /** KO stamp slam, dramatic reveals */
    ko: 0.7,
    /** Down-for-the-count, slow loops */
    slow: 1.2,
  },
  easings: {
    /** Standard ease-out for entrances */
    out: [0.16, 1, 0.3, 1] as const,
    /** Snappy in-out for punches */
    punch: [0.65, 0, 0.35, 1] as const,
    /** Heavy slam — overshoot then settle */
    slam: [0.34, 1.56, 0.64, 1] as const,
    /** Gentle for ambient loops */
    gentle: [0.4, 0, 0.2, 1] as const,
  },
} as const;

export type MotionDuration = keyof typeof motionTokens.durations;
export type MotionEasing = keyof typeof motionTokens.easings;

/**
 * Theme palette tokens — exported for non-Tailwind consumers (e.g. inline SVG).
 *
 * Dark-first. `canvas` is the main surface family (deep → elevated) and
 * `charcoal` is the text family (bright → muted). Component code stays in
 * the same vocabulary; the values flipped to a calm low-glare dark theme.
 *
 * `sunset` is a separate accent palette used by the landing / sign-in /
 * celebration surfaces via the `bg-sunset*` gradient utilities below — meant
 * to evoke the dusk training scenes from the source material rather than be
 * an ambient backdrop.
 */
export const palette = {
  /** Surface family — was "ring canvas" off-white, now deep matte black */
  canvas: {
    /** main page background */
    DEFAULT: '#0F0E12',
    /** cards, headers, slightly elevated */
    soft: '#16151B',
    /** dialogs, popovers, second elevation */
    deep: '#1F1D27',
  },
  /** Glove red — boxing-glove leather. Toned a touch on dark for less glare. */
  glove: {
    DEFAULT: '#C0392B',
    bright: '#E74C3C',
    deep: '#8E2A1F',
  },
  /** Text family — was "charcoal" inks, now warm off-whites */
  charcoal: {
    /** primary text */
    DEFAULT: '#EAE4D6',
    /** secondary / muted */
    soft: '#9A9485',
    /** legacy alias for the deepest ink — kept so SVGs that needed near-black still get it */
    ink: '#0B0908',
  },
  /** KO yellow — celebration accent. Slightly muted for dark mode. */
  ko: {
    DEFAULT: '#F6CB3C',
    bright: '#FFE066',
    deep: '#C8A025',
  },
  /** Ring rope — secondary accent */
  rope: {
    DEFAULT: '#A8421C',
    light: '#D17A4F',
  },
  /** Sunset — used by landing / sign-in. Evokes the dusk rooftop scenes. */
  sunset: {
    /** Highest sky — deep indigo before the colour starts */
    night: '#1A1238',
    /** Upper sunset, plum into violet */
    plum: '#4B1E55',
    /** The hot band, magenta into coral */
    magenta: '#B73E63',
    /** The glow line on the horizon */
    coral: '#E66B4A',
    /** Late peach, fading into rooftop highlight */
    peach: '#F2A668',
    /** The sun itself */
    amber: '#F7C566',
  },
} as const;

const preset = {
  // `content` is intentionally empty — consumer apps declare their own globs.
  content: [],
  theme: {
    extend: {
      colors: {
        canvas: palette.canvas,
        glove: palette.glove,
        charcoal: palette.charcoal,
        ko: palette.ko,
        rope: palette.rope,
        sunset: palette.sunset,
      },
      backgroundImage: {
        // Full-bleed dusk: indigo top → plum → magenta band → coral horizon →
        // peach glow at the bottom. Use on hero sections that should *feel*
        // like a rooftop sundown — landing, sign-in, KO celebration.
        'sunset-dusk': `linear-gradient(180deg,
          ${palette.sunset.night} 0%,
          ${palette.sunset.plum} 32%,
          ${palette.sunset.magenta} 58%,
          ${palette.sunset.coral} 78%,
          ${palette.sunset.peach} 100%)`,
        // Horizontal variant — the sun on the right, deepening into night
        // on the left. For side-panel hero treatments.
        'sunset-horizon': `linear-gradient(90deg,
          ${palette.sunset.night} 0%,
          ${palette.sunset.plum} 35%,
          ${palette.sunset.magenta} 65%,
          ${palette.sunset.amber} 100%)`,
        // Radial sun — drop on top of -dusk to suggest a sun disc behind
        // a silhouette. Combine via bg-[image:var(...)] later if desired.
        'sunset-sun': `radial-gradient(circle at 50% 78%,
          ${palette.sunset.amber} 0%,
          ${palette.sunset.coral} 14%,
          transparent 35%)`,
        // Subtle film-grain noise overlay (svg data uri). Layer on top of
        // gradients to break up banding and add that anime-cel grit.
        'film-grain':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
      fontFamily: {
        // Display: punchy, condensed — used for KO, round headers
        display: ['"Bebas Neue"', '"Oswald"', 'Impact', 'sans-serif'],
        // Body: clean sans for readability
        sans: ['"Inter"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        // Hand: used for coach bubble copy
        hand: ['"Caveat"', '"Patrick Hand"', 'cursive'],
        // Mono: code / proof artifacts
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Tight scale tuned for compact rating dashboards
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        // Display sizes for KO stamp / round titles
        'ko-stamp': ['5rem', { lineHeight: '1', letterSpacing: '0.02em' }],
        'round-header': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.01em' }],
      },
      spacing: {
        // Custom rhythm tuned to the ring-rope motif (multiples of 12px)
        ring: '1.5rem',
        rope: '0.75rem',
      },
      borderRadius: {
        glove: '0.75rem',
      },
      boxShadow: {
        ring: '0 4px 24px -8px rgba(31, 27, 23, 0.18)',
        ko: '0 0 0 4px rgba(255, 214, 10, 0.35), 0 8px 32px -8px rgba(255, 214, 10, 0.5)',
        glove: '0 6px 18px -4px rgba(192, 57, 43, 0.4)',
      },
      transitionDuration: {
        instant: `${motionTokens.durations.instant * 1000}ms`,
        quick: `${motionTokens.durations.quick * 1000}ms`,
        punch: `${motionTokens.durations.punch * 1000}ms`,
        ko: `${motionTokens.durations.ko * 1000}ms`,
        slow: `${motionTokens.durations.slow * 1000}ms`,
      },
      transitionTimingFunction: {
        out: `cubic-bezier(${motionTokens.easings.out.join(', ')})`,
        punch: `cubic-bezier(${motionTokens.easings.punch.join(', ')})`,
        slam: `cubic-bezier(${motionTokens.easings.slam.join(', ')})`,
        gentle: `cubic-bezier(${motionTokens.easings.gentle.join(', ')})`,
      },
      keyframes: {
        'punch-swoosh': {
          '0%': { transform: 'translateX(-40%) scale(0.9)', opacity: '0' },
          '40%': { opacity: '1' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        'ko-slam': {
          '0%': { transform: 'scale(2.2) rotate(-12deg)', opacity: '0' },
          '60%': { transform: 'scale(0.92) rotate(-6deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'bell-shake': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-12deg)' },
          '40%': { transform: 'rotate(10deg)' },
          '60%': { transform: 'rotate(-8deg)' },
          '80%': { transform: 'rotate(6deg)' },
        },
      },
      animation: {
        'punch-swoosh': `punch-swoosh ${motionTokens.durations.punch}s cubic-bezier(${motionTokens.easings.punch.join(',')})`,
        'ko-slam': `ko-slam ${motionTokens.durations.ko}s cubic-bezier(${motionTokens.easings.slam.join(',')})`,
        'bell-shake': `bell-shake ${motionTokens.durations.punch}s ease-in-out`,
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
