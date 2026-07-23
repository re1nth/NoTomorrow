import type { ReactNode } from 'react';

/**
 * Anime-episode-title-card header. Red wordmark with a glow, a slash
 * accent underneath, and a soft radial vignette behind — matches the
 * landing page's "NO TOMORROW" treatment.
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
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-x-10 -inset-y-6 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 130% at 22% 50%, rgba(230,57,70,0.18) 0%, rgba(230,57,70,0) 70%)',
          }}
        />
        <h1
          className="relative font-display uppercase tracking-wider text-4xl md:text-5xl leading-none text-[#E63946] drop-shadow-[0_0_28px_rgba(230,57,70,0.55)]"
          style={{ WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}
        >
          {title}
        </h1>
        <div
          className="relative mt-3 h-1 w-24 bg-[#E63946] rounded-sm"
          style={{ boxShadow: '0 0 14px rgba(230,57,70,0.6)' }}
        />
        {subtitle ? (
          <p className="relative text-sm text-charcoal-soft mt-3">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
