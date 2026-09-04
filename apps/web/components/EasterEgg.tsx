'use client';

import { Celebration } from '@/components/Celebration';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Corner easter egg. A small mushroom in the bottom-right; five clicks
 * grow it (each click gives a satisfying squish-and-bounce), the fifth
 * click explodes the cap into wedges + spore particles and releases a
 * 15-second balloons + confetti party plus a "Happy 27 !!" text near
 * the mushroom's corner. The mushroom fades back at base size once the
 * party finishes.
 *
 * Respects `prefers-reduced-motion` via Celebration — the party layer
 * never plays; the mushroom itself still renders so the corner isn't
 * empty and the click/growth mechanics still work.
 */

const BASE_SIZE = 34;
const CLICKS_TO_CRACK = 5;
const CRACK_DURATION_MS = 800;
const PARTY_DURATION_MS = 15000;
const GROWTH = [1, 1.3, 1.6, 2, 2.5] as const;
const MAX_GROWTH = 2.5;

type Phase = 'idle' | 'cracking' | 'party';

export function EasterEgg() {
  const [clicks, setClicks] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const handleClick = () => {
    if (phase !== 'idle') return;
    const next = clicks + 1;
    if (next >= CLICKS_TO_CRACK) {
      setClicks(0);
      setPhase('cracking');
    } else {
      setClicks(next);
    }
  };

  useEffect(() => {
    if (phase === 'cracking') {
      const t = window.setTimeout(() => setPhase('party'), CRACK_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'party') {
      const t = window.setTimeout(() => setPhase('idle'), PARTY_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    return;
  }, [phase]);

  const scale = GROWTH[Math.min(clicks, GROWTH.length - 1)] ?? 1;
  const shapeVisible = phase === 'idle';
  const cracking = phase === 'cracking';

  return (
    <>
      <Celebration visible={phase === 'party'} />
      <div
        className="fixed bottom-4 right-4 z-40 flex items-end justify-end"
        style={{ width: BASE_SIZE * 3, height: BASE_SIZE * 3 }}
      >
        <AnimatePresence>
          {shapeVisible ? (
            <motion.button
              key="mushroom"
              type="button"
              aria-label="Something surprising"
              onClick={handleClick}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale,
                scaleY: [1, 0.75, 1.1, 1, 1],
                scaleX: [1, 1.15, 0.95, 1, 1],
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{
                scale: { type: 'spring', stiffness: 260, damping: 18 },
                scaleX: { duration: 0.45, ease: 'easeOut' },
                scaleY: { duration: 0.45, ease: 'easeOut' },
                opacity: { duration: 0.4 },
              }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ko rounded-full"
              style={{ transformOrigin: 'bottom center' }}
            >
              <Mushroom size={BASE_SIZE} />
            </motion.button>
          ) : null}
        </AnimatePresence>
        {cracking ? <MushroomExplode size={BASE_SIZE * MAX_GROWTH} /> : null}
      </div>
    </>
  );
}

function MushroomDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <radialGradient id={`${prefix}-cap`} cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FF8577" />
        <stop offset="55%" stopColor="#E74C3C" />
        <stop offset="100%" stopColor="#8E2A1F" />
      </radialGradient>
      <linearGradient id={`${prefix}-stem`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFF3D9" />
        <stop offset="50%" stopColor="#FFEBB8" />
        <stop offset="100%" stopColor="#D6C79A" />
      </linearGradient>
      <radialGradient id={`${prefix}-flash`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(255, 220, 200, 0.95)" />
        <stop offset="60%" stopColor="rgba(231, 76, 60, 0.35)" />
        <stop offset="100%" stopColor="rgba(231, 76, 60, 0)" />
      </radialGradient>
    </defs>
  );
}

function MushroomStem({ prefix }: { prefix: string }) {
  return (
    <path
      d="M14 26 L 14 44 Q 14 46 16 46 L 24 46 Q 26 46 26 44 L 26 26 Z"
      fill={`url(#${prefix}-stem)`}
      stroke="rgba(0,0,0,0.15)"
      strokeWidth="0.6"
    />
  );
}

function Mushroom({ size }: { size: number }) {
  const w = size;
  const h = size * 1.2;
  return (
    <svg width={w} height={h} viewBox="0 0 40 48" aria-hidden="true">
      <MushroomDefs prefix="m" />
      <MushroomStem prefix="m" />
      <path
        d="M3 26 Q 3 6 20 3 Q 37 6 37 26 Q 37 28 35 28 L 5 28 Q 3 28 3 26 Z"
        fill="url(#m-cap)"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.6"
      />
      <circle cx="11" cy="15" r="2.2" fill="rgba(255,255,255,0.92)" />
      <circle cx="22" cy="9" r="2.8" fill="rgba(255,255,255,0.92)" />
      <circle cx="30" cy="16" r="1.9" fill="rgba(255,255,255,0.92)" />
      <circle cx="17" cy="22" r="1.7" fill="rgba(255,255,255,0.92)" />
      <circle cx="28" cy="23" r="1.4" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}

// Cap breaks into 4 radial wedges plus a scatter of white spore
// particles; stem collapses down into itself. Flash pulses out from
// the seam.
function MushroomExplode({ size }: { size: number }) {
  const w = size;
  const h = size * 1.2;
  const wedges = [
    { rotate: 0, dx: 0, dy: -30 },
    { rotate: 90, dx: 26, dy: -6 },
    { rotate: -90, dx: -26, dy: -6 },
    { rotate: 180, dx: 0, dy: 20 },
  ];
  const spores = [
    { dx: -12, dy: -18 },
    { dx: 10, dy: -22 },
    { dx: -18, dy: 4 },
    { dx: 16, dy: 2 },
  ];
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 40 48"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <MushroomDefs prefix="me" />
        <motion.circle
          cx="20"
          cy="20"
          r="4"
          fill="url(#me-flash)"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 9, opacity: [0, 1, 0] }}
          transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.25, 1] }}
        />
        {wedges.map((wd, i) => (
          <motion.path
            key={i}
            d="M20 16 L 30 8 L 32 22 Z"
            fill="url(#me-cap)"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="0.6"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
            animate={{
              x: wd.dx,
              y: wd.dy,
              rotate: wd.rotate + 120,
              opacity: [1, 1, 0],
              scale: [1, 1, 0.6],
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], times: [0, 0.5, 1] }}
          />
        ))}
        {spores.map((sp, i) => (
          <motion.circle
            key={i}
            cx="20"
            cy="16"
            r="2"
            fill="rgba(255,255,255,0.9)"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: sp.dx, y: sp.dy, opacity: [1, 1, 0] }}
            transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.5, 1] }}
          />
        ))}
        <motion.g
          initial={{ scaleY: 1, opacity: 1 }}
          animate={{ scaleY: 0.1, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeIn' }}
          style={{ transformOrigin: '20px 46px' }}
        >
          <MushroomStem prefix="me" />
        </motion.g>
      </svg>
    </div>
  );
}
