import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyEmailForm } from '@/components/VerifyEmailForm';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) {
    redirect('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        <h1
          className="font-display text-[#E63946] leading-[0.82] tracking-[0.02em] text-left
                     text-6xl md:text-7xl
                     drop-shadow-[0_0_30px_rgba(230,57,70,0.35)]"
          style={{ WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}
        >
          <span className="block">PLUS</span>
          <span className="block pl-[0.9em] mt-3 md:mt-4">ONE</span>
        </h1>
        <div
          className="h-1.5 w-40 md:w-56 bg-[#E63946] rounded-sm"
          style={{ boxShadow: '0 0 18px rgba(230,57,70,0.55)' }}
        />
        <VerifyEmailForm email={email} />
        <p className="text-sm text-white/70">
          Wrong email?{' '}
          <Link href="/register" className="text-[#E63946] hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </main>
  );
}
