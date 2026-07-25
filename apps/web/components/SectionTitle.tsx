import type { ReactNode } from 'react';

/**
 * Anime-episode-title-card header. Red wordmark with a glow, a slash
 * accent underneath, and a soft radial wash that spans the full banner
 * width so the light fades naturally into the page instead of clipping
 * against a narrow content column.
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
    <header className="relative mb-8 overflow-hidden">
      <div
        aria-hidden
        className="absolute -inset-x-8 -inset-y-4 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 220% at 8% 50%, rgba(230,57,70,0.22) 0%, rgba(230,57,70,0.08) 45%, rgba(230,57,70,0) 82%)',
        }}
      />
      <div className="relative flex items-start justify-between gap-4">
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
          {subtitle ? <p className="text-sm text-charcoal-soft mt-3">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
