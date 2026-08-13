import { ResetPasswordForm } from '@/components/ResetPasswordForm';
import { auth } from '@/lib/nextauth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await auth();
  if (session?.user?.id) {
    redirect('/counters');
  }
  if (!token) {
    redirect('/forgot-password');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
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
        <p className="text-sm text-white/70 text-center max-w-sm">
          Choose a new password. This link is single-use and expires 1 hour after it was sent.
        </p>
        <ResetPasswordForm token={token} />
        <p className="text-sm text-white/70">
          <Link href="/login" className="text-[#E63946] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
