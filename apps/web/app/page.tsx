import { LandingHero } from '@/components/LandingHero';
import { getUserId } from '@/lib/auth';
import { Button } from '@/lib/ui';
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

  if (!isCloud) {
    return (
      <LandingHero>
        <Link href="/counters">
          <Button variant="primary" size="lg" className="text-lg md:text-xl px-8 py-4">
            Step into the ring
          </Button>
        </Link>
      </LandingHero>
    );
  }

  const safe = safeNext(next);
  const loginHref = safe === '/counters' ? '/login' : `/login?next=${encodeURIComponent(safe)}`;
  const registerHref =
    safe === '/counters' ? '/register' : `/register?next=${encodeURIComponent(safe)}`;

  return (
    <LandingHero>
      <div className="flex flex-col items-center gap-4">
        <Link href={loginHref}>
          <Button variant="primary" size="lg" className="text-lg md:text-xl px-8 py-4">
            Step into the ring
          </Button>
        </Link>
        <p className="text-sm text-white/70">
          New here?{' '}
          <Link href={registerHref} className="text-[#E63946] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </LandingHero>
  );
}

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
