import { useMemo } from 'react';
import { cn } from '../utils/cn.js';

export interface RatingSparklineProps {
  /** Ordered rating values (oldest → newest) */
  values: number[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Stroke colour (CSS) */
  color?: string;
  /** Fill area under line (subtle gradient) */
  filled?: boolean;
  /** Highlight the trailing endpoint */
  showEndpoint?: boolean;
  className?: string;
  /** Accessible label, e.g. "Stamina rating over last 30 days" */
  label?: string;
}

/**
 * Tiny SVG line chart used in the Rating Dashboard. No tooltips, no axes —
 * just shape over time. Larger charts use a different component.
 */
export function RatingSparkline({
  values,
  width = 120,
  height = 32,
  color = '#C0392B',
  filled = true,
  showEndpoint = true,
  className,
  label = 'Rating trend',
}: RatingSparklineProps) {
  const path = useMemo(() => buildPath(values, width, height), [values, width, height]);
  const gradientId = useMemo(
    () => `spark-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn('block', className)}
        aria-label={label}
        role="img"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block', className)}
      aria-label={label}
      role="img"
    >
      {filled ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path.line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path d={path.line} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {showEndpoint && path.last ? (
        <circle cx={path.last.x} cy={path.last.y} r={2.2} fill={color} />
      ) : null}
    </svg>
  );
}

function buildPath(
  values: number[],
  width: number,
  height: number,
): { line: string; last: { x: number; y: number } | null } {
  if (values.length === 0) return { line: '', last: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);
  const pad = 2;
  const usable = height - pad * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * usable;
    return { x, y };
  });

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  return { line, last: points[points.length - 1] ?? null };
}
