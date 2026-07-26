import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/nextauth';

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

        <form action={startSignIn}>
          <button
            type="submit"
            className="inline-flex items-center gap-3 rounded-md bg-white text-black
                       px-6 py-3 text-base font-medium
                       hover:bg-white/90 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
          >
            <GoogleG />
            Sign in with Google
          </button>
        </form>
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

function GoogleG() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      width="20"
      height="20"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
