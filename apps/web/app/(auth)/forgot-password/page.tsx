import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { auth } from '@/lib/nextauth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect('/counters');
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
          Enter your email and we&apos;ll send you a link to choose a new password. The link is
          valid for 1 hour.
        </p>
        <ForgotPasswordForm />
        <p className="text-sm text-white/70">
          <Link href="/login" className="text-[#E63946] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
