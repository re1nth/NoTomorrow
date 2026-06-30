'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/lib/ui';

/**
 * Landing page. Single punchy CTA into Counters. Sunset gradient background
 * with a comic-style POW! burst behind the title — nothing else competing
 * for attention.
 */
export default function HomePage() {
  return (
    <main className="sunset-hero-with-sun relative min-h-screen flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        <div className="relative inline-block">
          <PowBurst />
          <motion.h1
            initial={{ scale: 0.92, rotate: -3, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 140, damping: 14 }}
            className="relative font-display tracking-tighter text-charcoal leading-none
                       text-7xl md:text-9xl drop-shadow-[0_4px_28px_rgba(0,0,0,0.65)]"
          >
            NO
            <br />
            TOMORROW
          </motion.h1>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="font-display uppercase tracking-[0.3em] text-sm md:text-base text-charcoal drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
        >
          Show up. Throw the punch. Every day.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, type: 'spring', stiffness: 200, damping: 18 }}
        >
          <Link href="/counters">
            <Button
              variant="primary"
              size="lg"
              className="text-lg md:text-xl px-8 py-4 shadow-[0_8px_30px_rgba(192,57,43,0.45)]"
            >
              🥊 Step into the ring
            </Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

/**
 * Comic-book POW! burst sitting behind the title. Pure SVG so it scales
 * cleanly and ships zero bytes of raster.
 */
function PowBurst() {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 600 600"
      className="absolute -inset-12 -z-10 pointer-events-none"
      initial={{ scale: 0.7, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: -8, opacity: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 130, damping: 12 }}
    >
      <defs>
        <radialGradient id="powGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F7C566" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#E66B4A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#B73E63" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Soft halo */}
      <circle cx="300" cy="300" r="240" fill="url(#powGlow)" />
      {/* Jagged star — 24-point burst */}
      <polygon
        fill="#F7C566"
        opacity="0.92"
        points="300,40 320,150 410,90 380,200 500,180 410,260 560,300 410,340
                500,420 380,400 410,510 320,450 300,560 280,450 190,510 220,400
                100,420 190,340 40,300 190,260 100,180 220,200 190,90 280,150"
      />
      {/* Inner star — orange */}
      <polygon
        fill="#E66B4A"
        opacity="0.85"
        points="300,110 314,190 380,150 360,225 440,215 376,265 470,300 376,335
                440,385 360,375 380,450 314,410 300,490 286,410 220,450 240,375
                160,385 224,335 130,300 224,265 160,215 240,225 220,150 286,190"
      />
    </motion.svg>
  );
}

