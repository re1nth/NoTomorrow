import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export type CoachTone = 'hype' | 'stern' | 'analytical' | 'warm';
export type BubbleSide = 'left' | 'right';

export interface CoachBubbleProps {
  /** Message body — string or React tree */
  children: ReactNode;
  /** Coach voice register, affects styling */
  tone?: CoachTone;
  /** Which side the tail points to (default: left = coach speaking to user) */
  side?: BubbleSide;
  /** Optional name attribution (e.g. "Coach", "Kamogawa") */
  name?: string;
  /** Optional timestamp string */
  timestamp?: string;
  className?: string;
}

const toneStyles: Record<CoachTone, string> = {
  hype: 'bg-ko/15 border-ko text-charcoal',
  stern: 'bg-glove/10 border-glove text-charcoal',
  analytical: 'bg-canvas-deep border-charcoal/30 text-charcoal',
  warm: 'bg-canvas-soft border-rope text-charcoal',
};

/**
 * Speech bubble for coach messages. Renders with a tail on the chosen side,
 * tone-styled to match the coach's voice register.
 */
export function CoachBubble({
  children,
  tone = 'stern',
  side = 'left',
  name,
  timestamp,
  className,
}: CoachBubbleProps) {
  return (
    <div className={cn('flex flex-col', side === 'right' ? 'items-end' : 'items-start', className)}>
      {name ? (
        <div className="px-1 mb-1 font-display uppercase tracking-wide text-xs text-charcoal-soft">
          {name}
        </div>
      ) : null}
      <div
        className={cn(
          'relative max-w-prose rounded-glove border px-4 py-3 font-hand text-lg leading-snug shadow-ring',
          toneStyles[tone],
        )}
      >
        {children}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-4 w-3 h-3 border rotate-45',
            toneStyles[tone],
            side === 'left' ? '-left-1.5 border-r-0 border-t-0' : '-right-1.5 border-l-0 border-b-0',
          )}
        />
      </div>
      {timestamp ? (
        <div className="px-1 mt-1 text-2xs text-charcoal-soft/70 font-mono">{timestamp}</div>
      ) : null}
    </div>
  );
}
