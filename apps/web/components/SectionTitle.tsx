import { useId, type ReactNode } from 'react';

/**
 * Page header for /counters, /pomodoro, /profile.
 *
 * Full-bleed banner with a "dragon" glow that flows top-left → bottom-right
 * across the header — a thick blurred body plus brighter inner spine, with
 * matching bright radial halos at the head and tail so both terminals of
 * the body soften into a glow instead of ending in a hard stroke.
 *
 * The banner escapes the page's max-w content column via `-mx-6 md:-mt-6`,
 * which cancels the (app) layout's `<main class="px-6 pb-6 pt-20 md:pt-6">`
 * padding on the sides + top. This assumes SectionTitle is rendered as a
 * direct child of main, NOT inside the page's max-w wrapper. Inside the
 * banner the content re-imposes `max-w-5xl mx-auto` so the title lines up
 * with the cards below it.
 */
export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const glowId = useId();
  return (
    <header className="relative -mx-6 md:-mt-6 mb-8 overflow-hidden">
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 1000 200"
      >
        <defs>
          <filter id={glowId} x="-15%" y="-100%" width="130%" height="300%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <radialGradient id={`${glowId}-head`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,120,110,0.9)" />
            <stop offset="60%" stopColor="rgba(230,57,70,0.35)" />
            <stop offset="100%" stopColor="rgba(230,57,70,0)" />
          </radialGradient>
          <radialGradient id={`${glowId}-tail`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,120,110,0.9)" />
            <stop offset="60%" stopColor="rgba(230,57,70,0.35)" />
            <stop offset="100%" stopColor="rgba(230,57,70,0)" />
          </radialGradient>
        </defs>
        <path
          d="M-40,30 C 240,-10 380,220 640,140 C 820,90 990,220 1040,180"
          stroke="rgba(230,57,70,0.55)"
          strokeWidth="30"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />
        <path
          d="M-40,30 C 240,-10 380,220 640,140 C 820,90 990,220 1040,180"
          stroke="rgba(231,76,60,0.9)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />
        <ellipse cx="30" cy="35" rx="90" ry="60" fill={`url(#${glowId}-head)`} />
        <ellipse cx="1000" cy="175" rx="90" ry="60" fill={`url(#${glowId}-tail)`} />
      </svg>
      <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-8">
        {/* Stack the right slot below the title on narrow viewports — the
            header has overflow-hidden and the right slot is shrink-0, so
            fitting them side-by-side on a 375px phone slices the CTA off
            the right edge. sm:+ keeps the original inline layout. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1
              className="font-display uppercase tracking-wider text-4xl md:text-5xl leading-none text-[#E63946] drop-shadow-[0_0_28px_rgba(230,57,70,0.55)]"
              style={{ WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}
            >
              {title}
            </h1>
            <div
              className="mt-3 h-1 w-24 bg-[#E63946] rounded-sm"
              style={{ boxShadow: '0 0 14px rgba(230,57,70,0.6)' }}
            />
            {subtitle ? <p className="mt-3 text-sm text-charcoal-soft">{subtitle}</p> : null}
          </div>
          {right ? <div className="sm:shrink-0">{right}</div> : null}
        </div>
      </div>
    </header>
  );
}
