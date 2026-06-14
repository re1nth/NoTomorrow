import { useEffect } from 'react';
import { motion, useReducedMotion as fmUseReducedMotion } from 'framer-motion';
import { motionTokens } from '../tailwind.preset.js';
import { useReducedMotion } from '../utils/useReducedMotion.js';
import { playSound } from '../utils/sound.js';
import { cn } from '../utils/cn.js';

export interface BellRingProps {
  /** Trigger the ring animation (toggle to replay) */
  ringing?: boolean;
  /** Pixel size */
  size?: number;
  /** Opt-in audio bell. Off by default. */
  sound?: boolean;
  /** Optional onClick (e.g. dismiss notification) */
  onClick?: () => void;
  className?: string;
  /** Accessible label */
  label?: string;
}

/**
 * BellRing — round-start / milestone-unlock indicator. Shakes when `ringing`
 * is true and optionally plays the bell SFX (opt-in, default off).
 */
export function BellRing({
  ringing = false,
  size = 32,
  sound = false,
  onClick,
  className,
  label = 'Round bell',
}: BellRingProps) {
  const reduced = useReducedMotion() || fmUseReducedMotion();

  useEffect(() => {
    if (ringing && sound) playSound('bell');
  }, [ringing, sound]);

  const animateProps =
    ringing && !reduced
      ? {
          rotate: [0, -12, 10, -8, 6, 0],
        }
      : { rotate: 0 };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      animate={animateProps}
      transition={{
        duration: motionTokens.durations.punch,
        ease: 'easeInOut',
      }}
      className={cn(
        'inline-flex items-center justify-center text-charcoal hover:text-glove',
        'transition-colors duration-quick',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glove rounded',
        className,
      )}
      style={{ width: size, height: size, transformOrigin: '50% 0%' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 16V10a6 6 0 1 1 12 0v6" />
        <path d="M4 16h16" />
        <path d="M10 19a2 2 0 0 0 4 0" />
        {ringing ? (
          <>
            <path d="M20 6l1.5-1.5" opacity="0.6" />
            <path d="M4 6L2.5 4.5" opacity="0.6" />
          </>
        ) : null}
      </svg>
    </motion.button>
  );
}
