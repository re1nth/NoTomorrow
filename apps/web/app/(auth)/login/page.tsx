import { CredentialsForm } from '@/components/CredentialsForm';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { getUserId } from '@/lib/auth';
import { hasGoogleOAuth } from '@/lib/oauth-config';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Kept out of `/` so the landing page renders no credential inputs —
// browser reputation classifiers (Safe Browsing) flag a bare domain
// whose root is an email/password form as phishing-shaped.
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const { next, verified, reset } = await searchParams;
  const uid = await getUserId();
  if (uid) redirect(safeNext(next));

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
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        <Link href="/" className="flex flex-col items-center gap-3">
          <h1
            className="font-brush text-[#E63946] leading-[0.82] tracking-[0.02em] text-center
                       text-6xl md:text-7xl
                       drop-shadow-[0_0_30px_rgba(230,57,70,0.35)]"
            style={{ WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}
          >
            NO
            <br />
            TOMORROW
          </h1>
          <div
            className="h-1.5 w-40 md:w-56 bg-[#E63946] rounded-sm"
            style={{ boxShadow: '0 0 18px rgba(230,57,70,0.55)' }}
          />
        </Link>
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
      </div>
    </main>
  );
}

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
