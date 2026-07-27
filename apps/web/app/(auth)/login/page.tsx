import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { auth, signIn } from '@/lib/nextauth';
import { redirect } from 'next/navigation';

// Rendered per request — the redirect-if-signed-in check needs to run
// on every hit, not at build time.
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await auth();
  if (session?.user?.id) {
    redirect(safeNext(next));
  }

  const startSignIn = async () => {
    'use server';
    await signIn('google', { redirectTo: safeNext(next) });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md">
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

        {error ? (
          <p className="text-sm text-red-400 text-center max-w-xs">
            Sign-in didn&apos;t complete. Try again.
          </p>
        ) : null}

        <GoogleSignInButton action={startSignIn} />
      </div>
    </main>
  );
}

function safeNext(next: string | undefined): string {
  // Only allow same-origin relative paths so a crafted ?next=https://evil
  // can't turn the OAuth callback into an open redirect.
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
