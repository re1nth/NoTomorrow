'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Birthday-style celebration overlay. Two independent layers:
 *
 *   - The ambient layer (balloons rising from the bottom + confetti
 *     falling from the top) plays for as long as `visible` is true —
 *     sits at z-0 so main content paints on top and it reads as an
 *     ambient background between the cards.
 *
 *   - The "Happy 27 !!" text plays for a shorter beat (~5s) so it
 *     doesn't overstay its welcome, then fades out while the balloons
 *     and confetti keep flowing. Rendered at z-40 in the bottom-right
 *     right above where the mushroom pops from, so it sits above the
 *     card grid instead of being hidden behind it.
 *
 * Respects the OS "Reduce Motion" preference — hidden entirely when
 * it's set, regardless of the `visible` prop.
 */

const TEXT_DURATION_MS = 5000;

// Coral — chosen from a broader palette compare against the mushroom
// pop's warm-red cap. Baked in; if a new tint is ever wanted, override
// via a prop rather than reintroducing a palette map.
const TEXT_TONE = { text: '#E66B4A', glow: 'rgba(230,107,74,' } as const;

export function Celebration({ visible }: { visible: boolean }) {
  const reduced = useReducedMotion();
  const shouldRender = visible && !reduced;

  const [textVisible, setTextVisible] = useState(false);
  useEffect(() => {
    if (!shouldRender) {
      setTextVisible(false);
      return;
    }
    setTextVisible(true);
    const t = window.setTimeout(() => setTextVisible(false), TEXT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [shouldRender]);

  return (
    <>
      <AnimatePresence>
        {shouldRender ? (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          >
            <RisingBalloons />
            <ConfettiFall />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>{textVisible ? <BirthdayText /> : null}</AnimatePresence>
    </>
  );
}

// Palette drawn from the app tokens: glove red, KO yellow, plus the
// sunset warm-band range for variety.
const COLORS = [
  '#C0392B', // glove
  '#E74C3C', // glove-bright
  '#F6CB3C', // ko
  '#FFE066', // ko-bright
  '#B73E63', // sunset-magenta
  '#E66B4A', // sunset-coral
  '#F2A668', // sunset-peach
  '#F7C566', // sunset-amber
] as const;

function pick<T>(arr: readonly T[], i: number): T {
  const v = arr[Math.abs(i) % arr.length];
  if (v === undefined) throw new Error('pick from empty array');
  return v;
}

// Deterministic pseudo-random (mulberry32) so the confetti / balloon
// layout is stable across renders within a session.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function RisingBalloons() {
  const random = rng(0xba110042);
  const balloons = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    leftPct: (i / 14) * 100 + (random() - 0.5) * 6,
    size: 34 + random() * 26,
    color: pick(COLORS, i * 7 + 3),
    duration: 12 + random() * 8,
    // Small stagger so balloons don't all launch on the same frame.
    delay: random() * 4,
    sway: 20 + random() * 30,
  }));
  return (
    <>
      {balloons.map((b) => (
        <motion.div
          key={b.id}
          className="absolute"
          style={{ left: `${b.leftPct}%`, bottom: -100 }}
          initial={{ y: 0, x: 0 }}
          animate={{
            y: '-120vh',
            x: [0, b.sway, -b.sway, 0],
          }}
          transition={{
            y: { duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'linear' },
            x: {
              duration: b.duration / 2,
              delay: b.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        >
          <Balloon size={b.size} color={b.color} />
        </motion.div>
      ))}
    </>
  );
}

function Balloon({ size, color }: { size: number; color: string }) {
  const stringLen = size * 1.4;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div
        style={{
          width: size,
          height: size * 1.15,
          backgroundColor: color,
          borderRadius: '50% 50% 50% 50% / 55% 55% 45% 45%',
          boxShadow: `inset -${size * 0.12}px -${size * 0.12}px ${size * 0.18}px rgba(0,0,0,0.25), 0 0 ${size * 0.4}px ${color}55`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: size * 0.15,
            left: size * 0.2,
            width: size * 0.18,
            height: size * 0.28,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.35)',
            filter: 'blur(1.5px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -size * 0.08,
            left: '50%',
            transform: 'translateX(-50%)',
            width: size * 0.14,
            height: size * 0.14,
            backgroundColor: color,
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          }}
        />
      </div>
      <div
        style={{
          width: 1,
          height: stringLen,
          background: 'rgba(255,255,255,0.35)',
          marginTop: size * 0.08,
        }}
      />
    </div>
  );
}

/**
 * "Happy 27 !!" — sits above the mushroom's corner (bottom-right).
 * Springs in from the mushroom's pop point, holds with a subtle float
 * + glow pulse, fades out cleanly. Rendered at z-40 so it paints above
 * the counters card grid.
 *
 * Entry uses physics-based springs (not keyframe timings) so the
 * scale, rotate, and y all decay smoothly into rest — no snap between
 * the overshoot and the settled position. The continuous float on the
 * inner h1 is delayed until after the spring has settled so it
 * doesn't stack transforms with the entry mid-motion.
 */
function BirthdayText() {
  const glowLow = `${TEXT_TONE.glow}0.55)`;
  const glowHigh = `${TEXT_TONE.glow}0.9)`;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed bottom-24 right-6 z-40"
      initial={{ opacity: 0, y: 44, scale: 0.5, rotate: -10 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.9, transition: { duration: 0.6, ease: 'easeIn' } }}
      transition={{
        opacity: { duration: 0.5, ease: 'easeOut' },
        y: { type: 'spring', stiffness: 180, damping: 18, mass: 0.9 },
        scale: { type: 'spring', stiffness: 170, damping: 14, mass: 0.9 },
        rotate: { type: 'spring', stiffness: 140, damping: 11, mass: 0.8 },
      }}
    >
      <motion.h1
        animate={{
          y: [0, -6, 0],
          filter: [
            `drop-shadow(0 0 20px ${glowLow})`,
            `drop-shadow(0 0 40px ${glowHigh})`,
            `drop-shadow(0 0 20px ${glowLow})`,
          ],
        }}
        transition={{
          duration: 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        className="font-display uppercase tracking-wider text-right leading-none
                   text-4xl sm:text-5xl md:text-6xl"
        style={{ color: TEXT_TONE.text, WebkitTextStroke: '1.5px rgba(0,0,0,0.4)' }}
      >
        Happy 27 !!
      </motion.h1>
    </motion.div>
  );
}

function ConfettiFall() {
  const random = rng(0xc0ffe700);
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    leftPct: random() * 100,
    size: 5 + random() * 7,
    color: pick(COLORS, i * 3 + 1),
    duration: 5 + random() * 5,
    delay: random() * 4,
    rotate: 180 + random() * 540,
    sway: 20 + random() * 40,
    isRect: random() > 0.4,
  }));
  return (
    <>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.leftPct}%`, top: -20 }}
          initial={{ y: 0, x: 0, rotate: 0 }}
          animate={{
            y: '110vh',
            x: [0, p.sway, -p.sway, 0],
            rotate: p.rotate,
          }}
          transition={{
            y: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' },
            x: {
              duration: p.duration / 2,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            rotate: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' },
          }}
        >
          <div
            style={{
              width: p.isRect ? p.size : p.size * 0.9,
              height: p.isRect ? p.size * 1.6 : p.size * 0.9,
              backgroundColor: p.color,
              borderRadius: p.isRect ? 1 : '50%',
              boxShadow: `0 0 ${p.size}px ${p.color}66`,
            }}
          />
        </motion.div>
      ))}
    </>
  );
}
