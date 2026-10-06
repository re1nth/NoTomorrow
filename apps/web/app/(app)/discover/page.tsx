import { DiscoverPOC } from '@/components/DiscoverPOC';
import { SectionTitle } from '@/components/SectionTitle';

export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  return (
    <>
      <SectionTitle
        title="Discover"
        subtitle="Rotate the trackball. Frame a photo. Fade the greens."
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-soft"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search"
            aria-label="Search"
            className="w-full rounded-md border border-charcoal/20 bg-canvas py-2 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-glove"
          />
        </div>
        <DiscoverPOC />
      </div>
    </>
  );
}
