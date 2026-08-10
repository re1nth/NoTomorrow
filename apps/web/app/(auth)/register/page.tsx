import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CredentialsForm } from '@/components/CredentialsForm';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { auth } from '@/lib/nextauth';
import { hasGoogleOAuth } from '@/lib/oauth-config';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();
  if (session?.user?.id) {
    redirect(safeNext(next));
  }

  const googleEnabled = hasGoogleOAuth();

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full">
        <h1
          className="font-display text-[#E63946] leading-[0.82] tracking-[0.02em] text-center
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
        {googleEnabled ? (
          <>
            <GoogleSignInButton next={safeNext(next)} />
            <div className="flex items-center gap-3 w-full max-w-sm text-xs uppercase tracking-wider text-white/40">
              <div className="flex-1 h-px bg-white/15" />
              or
              <div className="flex-1 h-px bg-white/15" />
            </div>
          </>
        ) : null}
        <CredentialsForm mode="register" next={safeNext(next)} />
        <p className="text-sm text-white/70">
          Already have an account?{' '}
          <Link href={loginHref(next)} className="text-[#E63946] hover:underline">
            Sign in
          </Link>
        </p>
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

function loginHref(next: string | undefined): string {
  const safe = safeNext(next);
  return safe === '/counters' ? '/' : `/?next=${encodeURIComponent(safe)}`;
}
