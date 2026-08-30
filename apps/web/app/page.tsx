import { LandingHero } from '@/components/LandingHero';
import { getUserId } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Marketing home. Deliberately renders no credential inputs — sign-in
// lives at /login so a Safe Browsing crawler hitting the apex domain
// sees a marketing page, not a login form on a bare host.
export const dynamic = 'force-dynamic';

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const uid = await getUserId();
  if (uid) redirect(safeNext(next));

  const href = isCloud
    ? (() => {
        const safe = safeNext(next);
        return safe === '/counters' ? '/login' : `/login?next=${encodeURIComponent(safe)}`;
      })()
    : '/counters';

  return (
    <LandingHero>
      <Link href={href}>
        <button
          type="button"
          className="font-display uppercase tracking-wide rounded-glove
                     bg-glove text-canvas-soft hover:bg-glove-bright active:bg-glove-deep shadow-glove
                     transition-colors duration-quick ease-out
                     text-2xl md:text-4xl px-10 md:px-16 py-5 md:py-7"
        >
          Step into the ring
        </button>
      </Link>
    </LandingHero>
  );
}

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
