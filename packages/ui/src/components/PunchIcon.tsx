import type { SVGProps } from 'react';
import { cn } from '../utils/cn.js';

export type PunchType = 'jab' | 'hook' | 'uppercut' | 'dempsey_roll';

export interface PunchIconProps extends Omit<SVGProps<SVGSVGElement>, 'type'> {
  type: PunchType;
  size?: number;
  /** Accessible label override */
  label?: string;
}

const labels: Record<PunchType, string> = {
  jab: 'Jab — quick task (under 30 min)',
  hook: 'Hook — half-day task',
  uppercut: 'Uppercut — full-day task',
  dempsey_roll: 'Dempsey roll — milestone capstone',
};

/**
 * Icon per `PunchType`. Glyphs are intentionally simple line drawings so they
 * read at small sizes (task list rows) and large sizes (round detail header).
 */
export function PunchIcon({
  type,
  size = 24,
  label,
  className,
  ...rest
}: PunchIconProps) {
  const ariaLabel = label ?? labels[type];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={ariaLabel}
      className={cn('inline-block text-charcoal', className)}
      {...rest}
    >
      {type === 'jab' && <JabGlyph />}
      {type === 'hook' && <HookGlyph />}
      {type === 'uppercut' && <UppercutGlyph />}
      {type === 'dempsey_roll' && <DempseyRollGlyph />}
    </svg>
  );
}

function JabGlyph() {
  // Straight arrow — short, direct
  return (
    <>
      <path d="M4 12h12" />
      <path d="M14 8l4 4-4 4" />
      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
    </>
  );
}

function HookGlyph() {
  // Curved arc — sideways arc
  return (
    <>
      <path d="M5 18c0-6 4-10 10-10" />
      <path d="M12 5l3 3-3 3" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
    </>
  );
}

function UppercutGlyph() {
  // Vertical arrow — rising
  return (
    <>
      <path d="M12 20V6" />
      <path d="M8 10l4-4 4 4" />
      <circle cx="12" cy="21" r="1.2" fill="currentColor" />
    </>
  );
}

function DempseyRollGlyph() {
  // Spiral / multi-loop — the signature combo
  return (
    <>
      <path d="M5 12a5 5 0 1 1 10 0" />
      <path d="M19 12a7 7 0 1 1-14 0" />
      <path d="M15 8l3-2 1 3" />
    </>
  );
}
