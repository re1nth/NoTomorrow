import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export type CardTone = 'default' | 'glove' | 'ko' | 'muted';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual emphasis */
  tone?: CardTone;
  /** Optional header content (title row) */
  header?: ReactNode;
  /** Optional footer content (action row) */
  footer?: ReactNode;
  /** Add subtle hover lift */
  interactive?: boolean;
}

const toneClasses: Record<CardTone, string> = {
  default: 'bg-canvas-soft border-charcoal/10',
  glove: 'bg-canvas-soft border-glove/40',
  ko: 'bg-canvas-soft border-ko shadow-ko',
  muted: 'bg-canvas-deep border-charcoal/5',
};

/**
 * General-purpose surface. Use `tone="ko"` for milestone-cleared surfaces,
 * `tone="glove"` for active / current round, default for everything else.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = 'default', header, footer, interactive, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-glove border shadow-ring text-charcoal',
        'transition-shadow duration-quick ease-out',
        toneClasses[tone],
        interactive && 'hover:shadow-glove cursor-pointer',
        className,
      )}
      {...rest}
    >
      {header ? (
        <div className="px-5 pt-4 pb-3 border-b border-charcoal/10 font-display uppercase tracking-wide text-sm">
          {header}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
      {footer ? (
        <div className="px-5 pb-4 pt-3 border-t border-charcoal/10">{footer}</div>
      ) : null}
    </div>
  );
});
