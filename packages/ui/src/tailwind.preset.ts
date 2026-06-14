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
 */
export const palette = {
  /** Ring canvas — slightly warm off-white, like aged tatami */
  canvas: {
    DEFAULT: '#F5F1E8',
    soft: '#FBF8F1',
    deep: '#EBE4D2',
  },
  /** Glove red — boxing-glove leather */
  glove: {
    DEFAULT: '#C0392B',
    bright: '#E74C3C',
    deep: '#8E2A1F',
  },
  /** Charcoal — ring rope shadow, ink lines */
  charcoal: {
    DEFAULT: '#1F1B17',
    soft: '#3A332C',
    ink: '#0B0908',
  },
  /** KO yellow — neon celebration accent */
  ko: {
    DEFAULT: '#FFD60A',
    bright: '#FFE94D',
    deep: '#E6B800',
  },
  /** Ring rope — secondary accent */
  rope: {
    DEFAULT: '#A8421C',
    light: '#D17A4F',
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
