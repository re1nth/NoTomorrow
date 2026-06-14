import { useEffect, useState } from 'react';
import { motion, useReducedMotion as fmUseReducedMotion } from 'framer-motion';
import Lottie from 'lottie-react';
import koStampAnimation from '../lottie/ko-stamp.json' with { type: 'json' };
import { motionTokens } from '../tailwind.preset.js';
import { useReducedMotion } from '../utils/useReducedMotion.js';
import { playSound } from '../utils/sound.js';
import { cn } from '../utils/cn.js';

export interface KOStampProps {
  /** Trigger the stamp animation. Toggle false → true to replay. */
  active?: boolean;
  /** Label rendered inside the stamp (defaults to "KO") */
  label?: string;
  /** Size in pixels (square) */
  size?: number;
  /** Use Lottie playback instead of motion-based fallback */
  lottie?: boolean;
  /** Opt-in sound. Off by default. */
  sound?: boolean;
  /** Optional className override */
  className?: string;
}

/**
 * KO stamp — fires when a milestone (round) is cleared. Honours
 * `prefers-reduced-motion` by snapping to the final state without animation.
 *
 * Defaults to a CSS/motion fallback. Pass `lottie` to use the bundled
 * placeholder Lottie animation (richer art swap-in later).
 */
export function KOStamp({
  active = true,
  label = 'KO',
  size = 160,
  lottie = false,
  sound = false,
  className,
}: KOStampProps) {
  const reduced = useReducedMotion() || fmUseReducedMotion();
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (active && !played) {
      setPlayed(true);
      if (sound) playSound('ko');
    }
    if (!active) setPlayed(false);
  }, [active, played, sound]);

  if (!active) return null;

  if (lottie) {
    return (
      <div
        className={cn('inline-block', className)}
        style={{ width: size, height: size }}
        aria-label={`${label} stamp`}
        role="img"
      >
        <Lottie
          animationData={koStampAnimation}
          loop={false}
          autoplay={!reduced}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  const transition = reduced
    ? { duration: 0 }
    : {
        duration: motionTokens.durations.ko,
        ease: motionTokens.easings.slam,
      };

  return (
    <motion.div
      role="img"
      aria-label={`${label} stamp`}
      initial={reduced ? false : { scale: 2.2, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: -8, opacity: 1 }}
      transition={transition}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'border-[6px] border-ko bg-canvas-soft/90 text-ko-deep font-display',
        'shadow-ko',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42, lineHeight: 1 }}
    >
      <span className="tracking-widest">{label}</span>
    </motion.div>
  );
}
