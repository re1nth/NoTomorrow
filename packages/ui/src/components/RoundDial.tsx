import { motion, useReducedMotion as fmUseReducedMotion } from 'framer-motion';
import { motionTokens } from '../tailwind.preset.js';
import { useReducedMotion } from '../utils/useReducedMotion.js';
import { cn } from '../utils/cn.js';

export interface RoundDialProps {
  /** Progress in [0, 1] */
  value: number;
  /** Pixel diameter */
  size?: number;
  /** Ring thickness in px */
  stroke?: number;
  /** Optional label rendered in center (e.g. "R3" or "73%") */
  label?: string;
  /** Sub-label (smaller, below) */
  sublabel?: string;
  /** Use KO yellow when value reaches 1.0 */
  celebrateOnFull?: boolean;
  className?: string;
}

/**
 * RoundDial — circular progress for a single milestone / round.
 *
 * Used on the Roadmap View to show progress through a Round, and on the Gym
 * home card to show today's training completion.
 */
export function RoundDial({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  celebrateOnFull = true,
  className,
}: RoundDialProps) {
  const reduced = useReducedMotion() || fmUseReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const isFull = clamped >= 0.999;
  const trackColor = '#1F1B17';
  const progressColor = isFull && celebrateOnFull ? '#FFD60A' : '#C0392B';

  return (
    <div
      className={cn('inline-flex flex-col items-center justify-center', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeOpacity={0.12}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: motionTokens.durations.ko, ease: motionTokens.easings.out }
          }
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {(label || sublabel) && (
        <div
          className="absolute flex flex-col items-center pointer-events-none"
          style={{ width: size, height: size, marginTop: -size }}
        >
          <div className="flex-1 flex flex-col items-center justify-center">
            {label ? (
              <span className="font-display text-charcoal" style={{ fontSize: size * 0.24 }}>
                {label}
              </span>
            ) : null}
            {sublabel ? (
              <span
                className="font-sans text-charcoal-soft uppercase tracking-wide"
                style={{ fontSize: size * 0.1 }}
              >
                {sublabel}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
