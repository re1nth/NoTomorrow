import Link from 'next/link';
import { Button, Card } from '@/lib/ui';

/**
 * Public landing page. Single CTA into sign-in.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="font-display text-5xl md:text-round-header text-charcoal">
          No Tomorrow
        </h1>
        <p className="text-lg text-charcoal-soft">
          The internet&apos;s coach for people who want to ship. Set a goal, take
          the diagnostic, get a roadmap, and start punching.
        </p>
        <Card tone="glove" className="text-left">
          <p className="font-display uppercase tracking-wider text-sm text-glove">
            Round 1
          </p>
          <h2 className="text-2xl font-display mt-1 mb-3">
            Sign in and meet the coach.
          </h2>
          <p className="text-charcoal-soft mb-4">
            One starting domain (web-frontend), one goal, one daily punch. We
            grade your work and your rating moves.
          </p>
          <Link href="/sign-in">
            <Button variant="primary" size="lg">
              Step into the ring
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
