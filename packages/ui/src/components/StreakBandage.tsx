import { cn } from '../utils/cn.js';

export interface StreakBandageProps {
  /** Current streak length in days */
  days: number;
  /** Maximum bandage wraps to render before collapsing to "+N" */
  maxWraps?: number;
  /** Pixel height */
  height?: number;
  /** Show numeric label alongside */
  showLabel?: boolean;
  className?: string;
}

/**
 * StreakBandage — visualises the active streak as wrapped hand bandages.
 * One wrap per day, capped by `maxWraps`; surplus collapses to a `+N`
 * indicator at the end. Used on the Gym home surface.
 */
export function StreakBandage({
  days,
  maxWraps = 7,
  height = 24,
  showLabel = true,
  className,
}: StreakBandageProps) {
  const safe = Math.max(0, Math.floor(days));
  const visible = Math.min(safe, maxWraps);
  const overflow = safe - visible;
  const wraps = Array.from({ length: visible });

  return (
    <div
      className={cn('inline-flex items-center gap-2', className)}
      aria-label={`Streak: ${safe} day${safe === 1 ? '' : 's'}`}
      role="img"
    >
      <div
        className="relative flex items-center"
        style={{ height }}
        aria-hidden="true"
      >
        {/* fist base */}
        <div
          className="rounded-full bg-charcoal/80"
          style={{ width: height * 0.9, height, marginRight: -height * 0.3 }}
        />
        {/* wraps */}
        <div
          className="flex items-center bg-canvas-deep rounded-r-glove overflow-hidden border border-charcoal/15"
          style={{ height }}
        >
          {wraps.length === 0 ? (
            <span
              className="px-2 text-xs font-mono text-charcoal-soft/70 uppercase tracking-wider"
              style={{ lineHeight: `${height}px` }}
            >
              No streak
            </span>
          ) : (
            wraps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'block border-r border-charcoal/10 last:border-r-0',
                  i % 2 === 0 ? 'bg-canvas-soft' : 'bg-canvas',
                )}
                style={{ width: height * 0.55, height }}
              />
            ))
          )}
          {overflow > 0 ? (
            <span
              className="px-2 font-display text-xs text-glove uppercase tracking-wide bg-canvas-soft"
              style={{ lineHeight: `${height}px` }}
            >
              +{overflow}
            </span>
          ) : null}
        </div>
      </div>
      {showLabel ? (
        <span className="font-display uppercase tracking-wide text-sm text-charcoal">
          {safe} day{safe === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  );
}
