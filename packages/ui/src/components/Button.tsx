import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon / glove element */
  leading?: ReactNode;
  /** Optional trailing icon */
  trailing?: ReactNode;
  /** When true, button is full-width */
  block?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-display uppercase tracking-wide ' +
  'rounded-glove transition-colors duration-quick ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-glove focus-visible:ring-offset-canvas ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-glove text-canvas-soft hover:bg-glove-bright active:bg-glove-deep shadow-glove',
  secondary:
    'bg-charcoal text-canvas-soft hover:bg-charcoal-soft active:bg-charcoal-ink',
  ghost:
    'bg-transparent text-charcoal hover:bg-canvas-deep active:bg-canvas',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
};

/**
 * Primary call-to-action component. Variants map to the ring metaphor:
 *  - primary   → glove red (offensive: "Submit proof", "Start round")
 *  - secondary → charcoal  (neutral: navigation, defaults)
 *  - ghost     → text-only (tertiary: cancel, dismiss)
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leading, trailing, block, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {leading ? <span className="inline-flex shrink-0">{leading}</span> : null}
      {children}
      {trailing ? <span className="inline-flex shrink-0">{trailing}</span> : null}
    </button>
  );
});
