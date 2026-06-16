import Link from 'next/link';
import { Button, Card } from '@/lib/ui';

/**
 * Public landing page. Single CTA into sign-in. Wears the full sunset
 * treatment so the first impression is the rooftop-at-dusk mood.
 */
export default function HomePage() {
  return (
    <main className="sunset-hero-with-sun relative min-h-screen flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      <RooftopSilhouette />
      <div className="relative max-w-2xl text-center space-y-6 z-10">
        <h1 className="font-display text-6xl md:text-ko-stamp tracking-tight text-charcoal drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]">
          No Tomorrow
        </h1>
        <p className="text-lg text-charcoal/85">
          The internet&apos;s coach for people who want to ship. Set a goal, take
          the diagnostic, get a roadmap, and start punching.
        </p>
        <Card
          tone="glove"
          className="text-left bg-canvas/85 backdrop-blur-md border border-charcoal-soft/20 shadow-ring"
        >
          <p className="font-display uppercase tracking-wider text-sm text-sunset-amber">
            Round 1
          </p>
          <h2 className="text-2xl font-display mt-1 mb-3 text-charcoal">
            Sign in and meet the coach.
          </h2>
          <p className="text-charcoal-soft mb-4">
            One starting domain (web-frontend), one goal, one daily punch. We
            grade your work and your rating moves.
          </p>
          <Link href="/gym">
            <Button variant="primary" size="lg">
              Step into the ring
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}

/**
 * Inline SVG silhouette — a single boxer figure on a rooftop railing,
 * profile to the right where the sun sits. Pure black so it reads against
 * the gradient at every size. Ships with the bundle, no asset to load.
 */
function RooftopSilhouette() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 w-full h-[60%] pointer-events-none"
    >
      {/* far rooftops / horizon */}
      <path
        fill="#0B0908"
        opacity="0.55"
        d="M0,720 L120,720 L120,700 L220,700 L220,725 L380,725 L380,690 L520,690 L520,720 L700,720 L700,705 L860,705 L860,735 L1020,735 L1020,700 L1180,700 L1180,720 L1340,720 L1340,710 L1600,710 L1600,900 L0,900 Z"
      />
      {/* nearer rooftop slab */}
      <path
        fill="#0B0908"
        opacity="0.85"
        d="M0,820 L1600,820 L1600,900 L0,900 Z"
      />
      {/* railing */}
      <rect x="0" y="804" width="1600" height="6" fill="#0B0908" />
      {/* boxer silhouette — leaning on the railing, looking toward the sun */}
      <g fill="#050304">
        {/* legs */}
        <rect x="1115" y="730" width="14" height="74" />
        <rect x="1135" y="730" width="14" height="74" />
        {/* hips → torso */}
        <path d="M1100,690 L1170,690 L1162,732 L1108,732 Z" />
        {/* shoulders / arms leaning forward on rail */}
        <path d="M1090,656 L1180,656 L1196,710 L1078,710 Z" />
        {/* forward arm bracing on railing */}
        <path d="M1182,664 L1230,792 L1218,796 L1170,672 Z" />
        {/* head */}
        <circle cx="1134" cy="640" r="22" />
        {/* hair tuft */}
        <path d="M1118,624 q14,-18 32,-2 l-6,6 q-12,-10 -22,2 z" />
      </g>
    </svg>
  );
}
