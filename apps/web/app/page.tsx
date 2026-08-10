import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CredentialsForm } from '@/components/CredentialsForm';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { LandingHero } from '@/components/LandingHero';
import { Button } from '@/lib/ui';
import { getUserId } from '@/lib/auth';
import { hasGoogleOAuth } from '@/lib/oauth-config';

// Auth check runs per request. Desktop (local mode) always resolves a
// user and skips straight to /counters; cloud visitors without a
// session see the wordmark hero with the sign-in form inlined below.
export const dynamic = 'force-dynamic';

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const { next, verified, reset } = await searchParams;
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

  const flash =
    verified === '1'
      ? 'Email verified — sign in to continue.'
      : reset === '1'
        ? 'Password reset — sign in with your new password.'
        : null;
  const googleEnabled = hasGoogleOAuth();
  const safe = safeNext(next);
  const registerHref =
    safe === '/counters' ? '/register' : `/register?next=${encodeURIComponent(safe)}`;

  return (
    <LandingHero>
      <div className="flex flex-col items-center gap-5 w-full max-w-sm">
        {googleEnabled ? (
          <>
            <GoogleSignInButton next={safe} />
            <div className="flex items-center gap-3 w-full text-xs uppercase tracking-wider text-white/40">
              <div className="flex-1 h-px bg-white/15" />
              or
              <div className="flex-1 h-px bg-white/15" />
            </div>
          </>
        ) : null}
        <CredentialsForm mode="login" next={safe} initialFlash={flash} />
        <div className="text-sm text-white/70 flex flex-col items-center gap-1.5">
          <Link href="/forgot-password" className="text-[#E63946] hover:underline">
            Forgot password?
          </Link>
          <p>
            New here?{' '}
            <Link href={registerHref} className="text-[#E63946] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </LandingHero>
  );
}

function safeNext(next: string | undefined): string {
  // Only allow same-origin relative paths so a crafted ?next=https://evil
  // can't turn the redirect into an open redirect.
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
