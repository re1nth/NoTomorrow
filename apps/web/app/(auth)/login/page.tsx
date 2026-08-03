import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CredentialsForm } from '@/components/CredentialsForm';
import { auth } from '@/lib/nextauth';

// Rendered per request — the redirect-if-signed-in check needs to run
// on every hit, not at build time.
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const { next, verified, reset } = await searchParams;
  const session = await auth();
  if (session?.user?.id) {
    redirect(safeNext(next));
  }

  let flash: string | null = null;
  if (verified === '1') flash = 'Email verified — sign in to continue.';
  else if (reset === '1') flash = 'Password reset — sign in with your new password.';

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full">
        <Header />
        <CredentialsForm mode="login" next={safeNext(next)} initialFlash={flash} />
        <div className="text-sm text-white/70 flex flex-col items-center gap-2">
          <p>
            <Link href="/forgot-password" className="text-[#E63946] hover:underline">
              Forgot password?
            </Link>
          </p>
          <p>
            New here?{' '}
            <Link href={registerHref(next)} className="text-[#E63946] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Header() {
  return (
    <>
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
    </>
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

function registerHref(next: string | undefined): string {
  const safe = safeNext(next);
  return safe === '/counters' ? '/register' : `/register?next=${encodeURIComponent(safe)}`;
}
