'use client';

import { Button } from '@/lib/ui';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

/**
 * Landing page. Anime-title-card treatment: pitch-black background, a huge
 * red "NO TOMORROW" wordmark with a slash accent, and the top-tier Ippo
 * sprite as the sole character. Nothing else — the previous sunset + POW
 * + belt-parade version was too busy.
 *
 * `?static=1` (used by the README screenshot capture) and the OS "Reduce
 * Motion" setting both make the page land on its final visual state at
 * first paint.
 */
export default function HomePage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden bg-black">
      <TitleCardBackdrop />
      <Suspense fallback={<HeroBlock staticRender={false} />}>
        <Hero />
      </Suspense>
    </main>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const params = useSearchParams();
  const staticRender = reduced === true || params?.get('static') === '1';
  return <HeroBlock staticRender={staticRender} />;
}

function HeroBlock({ staticRender }: { staticRender: boolean }) {
  const titleProps = staticRender
    ? { initial: { opacity: 1, y: 0, scale: 1 } }
    : {
        initial: { opacity: 0, y: 24, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] as const },
      };
  const slashProps = staticRender
    ? { initial: { scaleX: 1 } }
    : {
        initial: { scaleX: 0 },
        animate: { scaleX: 1 },
        transition: { duration: 0.4, delay: 0.5, ease: [0.65, 0, 0.35, 1] as const },
      };
  const ctaProps = staticRender
    ? { initial: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay: 0.75 },
      };
  return (
    <div className="relative z-10 flex flex-col items-center gap-8">
      <ChampionSprite staticRender={staticRender} />

      <div className="flex flex-col items-center gap-3">
        <motion.h1
          {...titleProps}
          className="font-display text-[#E63946] leading-[0.82] tracking-[0.02em] text-center
                     text-7xl md:text-[10rem]
                     drop-shadow-[0_0_30px_rgba(230,57,70,0.35)]"
          style={{
            WebkitTextStroke: '1px rgba(0,0,0,0.25)',
          }}
        >
          NO
          <br />
          TOMORROW
        </motion.h1>

        {/* Red slash — the anime-title-card horizontal accent. Animates
        in left-to-right, like a brush stroke. */}
        <motion.div
          {...slashProps}
          className="h-1.5 w-56 md:w-72 bg-[#E63946] origin-left rounded-sm"
          style={{ boxShadow: '0 0 18px rgba(230,57,70,0.55)' }}
        />
      </div>

      <motion.div {...ctaProps}>
        <Link href="/counters">
          <Button variant="primary" size="lg" className="text-lg md:text-xl px-8 py-4">
            Step into the ring
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}

/**
 * Champion-belt Ippo — the "very last one" in the belt progression. Sits
 * above the title as the single character on the page. Hides itself if
 * the sprite file is ever missing so we never show a broken-image glyph.
 */
function ChampionSprite({ staticRender }: { staticRender: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const props = staticRender
    ? { initial: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: -14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
      };
  return (
    <motion.img
      {...props}
      src="/stickers/champion.png"
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
      className="pointer-events-none select-none"
      style={{
        height: 200,
        width: 'auto',
        imageRendering: 'pixelated',
        filter: 'drop-shadow(0 12px 24px rgba(230,57,70,0.4))',
      }}
    />
  );
}

/**
 * Faint red vignette on the black backdrop — barely visible, keeps the
 * pure-black surface from reading as OLED-flat while staying out of the
 * way of the title.
 */
function TitleCardBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, rgba(230,57,70,0.12) 0%, rgba(0,0,0,0) 55%)',
      }}
    />
  );
}
