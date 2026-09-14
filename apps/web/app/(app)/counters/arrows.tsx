'use client';

/**
 * Shared "ferromagnetic domain" arrow glyphs for the counter heatmaps.
 * Every filled cell renders a thin black arrow that points at the counter's
 * most recent check-in — a compass needle stitched into each square. On a
 * fresh +1 the whole field vibrates for a beat, then settles onto the new
 * target angle. Consumed by both the list card heatmaps and the per-counter
 * detail page's strips.
 */

import {
  type HTMLMotionProps,
  motion,
  useAnimationControls,
  useReducedMotion,
} from 'framer-motion';
import { useEffect, useRef } from 'react';

export const ARROW_HEX = '#0B0908';

export function angleDeg(
  from: { r: number; c: number },
  to: { r: number; c: number },
): number {
  const dx = to.c - from.c;
  const dy = to.r - from.r;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Rotate `target` to the copy nearest `prev` (mod 360) so a spring transition
// takes the shortest arc — a needle at 170° swinging to -170° goes through
// 180° (20° arc), not through 0° (340° arc).
export function shortestAngle(prev: number | undefined, target: number): number {
  if (prev === undefined) return target;
  let next = target;
  while (next - prev > 180) next -= 360;
  while (next - prev < -180) next += 360;
  return next;
}

// Column-major position of an ISO day within a heatmap grid, using the
// canonical anchor (start = leftmost Sunday, day = w*7 + r). Returns null if
// the day falls outside the visible window.
export function positionOf(
  iso: string | null,
  gridStart: Date,
  weeks: number,
): { c: number; r: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const cell = new Date(y, m - 1, d);
  const daysFromStart = Math.round((cell.getTime() - gridStart.getTime()) / 86400000);
  if (daysFromStart < 0 || daysFromStart >= weeks * 7) return null;
  return { c: Math.floor(daysFromStart / 7), r: daysFromStart % 7 };
}

// Thin 2D arrow: horizontal shaft + open V-head, drawn as strokes. Points
// right at rotation 0°. Sized to sit inside 10–13px heatmap cells and stay
// legible at the ultra strip's 12px width.
export function ThinArrow({
  size,
  hex = ARROW_HEX,
  weight = 1,
}: {
  size: number;
  hex?: string;
  weight?: number;
}) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M1.5,5 L8,5 M5.5,2.5 L8,5 L5.5,7.5"
        stroke={hex}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Solid dot marking the "north star" — the newest filled cell.
export function NewestDot({ size, hex = ARROW_HEX }: { size: number; hex?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: hex,
      }}
    />
  );
}

/**
 * Grid-compass cell contents: a thin arrow rotated toward the newest filled
 * cell, or a solid dot if this cell IS the newest. On every +1 (pulseKey
 * bump) the arrow first vibrates in place for ~350ms — the ferromagnetic
 * moment where each needle is agitated by the new field — then settles onto
 * its target angle along the shortest arc.
 */
export function CompassArrow({
  cellPos,
  newestPos,
  isNewest,
  pulseKey,
  size,
  weight = 1,
  dotSize = 4,
}: {
  cellPos: { c: number; r: number };
  newestPos: { c: number; r: number } | null;
  isNewest: boolean;
  pulseKey: number;
  size: number;
  weight?: number;
  dotSize?: number;
}) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const prevAngleRef = useRef<number | undefined>(undefined);

  const rawTarget = newestPos && !isNewest ? angleDeg(cellPos, newestPos) : 0;
  const adjTarget = shortestAngle(prevAngleRef.current, rawTarget);

  useEffect(() => {
    if (isNewest || !newestPos) return;
    // W3 model: the ARROW just springs smoothly to its new target. The
    // "vibration" energy lives on the enclosing <PulseCell>, which shakes
    // the cell body on X/Y. Rotation stays calm.
    controls.start({
      rotate: adjTarget,
      transition: { type: 'spring', stiffness: 160, damping: 18 },
    });
    prevAngleRef.current = adjTarget;
  }, [pulseKey, adjTarget, isNewest, newestPos, reduce, controls]);

  if (isNewest) return <NewestDot size={dotSize} />;
  if (!newestPos) {
    return <ThinArrow size={size} weight={weight} />;
  }
  return (
    <motion.div animate={controls} initial={false} style={{ lineHeight: 0 }}>
      <ThinArrow size={size} weight={weight} />
    </motion.div>
  );
}

// ─── Cell wrappers with the position tremor (demo W3) ─────────────────────
// Every filled cell shakes on X/Y when +1 lands. Each cell picks its own
// random tremor path so no two cells shake identically. The ARROW inside
// just springs to the new target — the vibration lives on the cell body,
// not the needle. Non-filled cells render an inert motion.div so we don't
// burn a hook per unfilled slot.

const TREMOR_SAMPLES = 12;
const TREMOR_AMP = 1.8; // pixels — ±1.8 px on X and Y independently
const TREMOR_PHASE_END = 0.45; // fraction of the total clock that shakes
const TREMOR_DURATION = 0.9;

function usePulse(filled: boolean, pulseKey: number) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  // Per-instance random seed so adjacent cells get different tremor paths.
  // Stable across re-renders; only changes if the cell unmounts.
  const seedRef = useRef<number>(0);
  if (seedRef.current === 0) {
    seedRef.current = Math.floor(Math.random() * 0x7fffffff) || 1;
  }

  useEffect(() => {
    if (!filled || pulseKey === 0 || reduce) return;
    let s = seedRef.current | 0;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      return ((s >>> 0) / 0xffffffff) * 2 - 1; // [-1, 1]
    };
    const xs: number[] = [0];
    const ys: number[] = [0];
    const times: number[] = [0];
    for (let k = 1; k <= TREMOR_SAMPLES; k++) {
      xs.push(rand() * TREMOR_AMP);
      ys.push(rand() * TREMOR_AMP);
      times.push((k / TREMOR_SAMPLES) * TREMOR_PHASE_END);
    }
    // Land back at (0, 0) for the tail so cells settle exactly where they
    // started — no drift accumulating across pulses.
    xs.push(0);
    ys.push(0);
    times.push(1);
    controls.start({
      x: xs,
      y: ys,
      transition: {
        duration: TREMOR_DURATION,
        times,
        ease: 'linear',
      },
    });
  }, [filled, pulseKey, reduce, controls]);
  return controls;
}

type PulseCellProps = HTMLMotionProps<'div'> & {
  filled: boolean;
  pulseKey: number;
};

export function PulseCell({ filled, pulseKey, ...rest }: PulseCellProps) {
  const controls = usePulse(filled, pulseKey);
  return <motion.div animate={controls} {...rest} />;
}

type PulseCellButtonProps = HTMLMotionProps<'button'> & {
  filled: boolean;
  pulseKey: number;
};

export function PulseCellButton({ filled, pulseKey, ...rest }: PulseCellButtonProps) {
  const controls = usePulse(filled, pulseKey);
  return <motion.button animate={controls} {...rest} />;
}
