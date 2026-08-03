'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export function VerifyEmailForm({ email: initialEmail }: { email: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Verification failed.');
        return;
      }
      // Verified — bounce to login with a nudge.
      const next = params.get('next');
      const loginHref = next ? `/login?verified=1&next=${encodeURIComponent(next)}` : '/login?verified=1';
      router.push(loginHref);
    });
  };

  const resend = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch('/api/auth/verify-email?resend=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setInfo('New code sent. Check your inbox.');
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterSeconds?: number;
        };
        if (body.retryAfterSeconds) {
          setError(`Wait ${body.retryAfterSeconds}s before requesting another code.`);
        } else {
          setError(body.error ?? 'Could not resend.');
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <p className="text-sm text-white/70 text-center">
        We sent a 6-digit code to <span className="text-white">{email}</span>.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/70">Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white text-center tracking-[0.5em] font-mono text-lg
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {info ? <p className="text-sm text-emerald-400">{info}</p> : null}

        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="inline-flex items-center justify-center rounded-md bg-[#E63946] text-white
                     px-6 py-3 text-base font-medium
                     hover:bg-[#E63946]/90 transition-colors disabled:opacity-60
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {pending ? '…' : 'Verify'}
        </button>
      </form>

      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="text-sm text-white/60 hover:text-white/90 underline underline-offset-4"
      >
        Didn&apos;t get a code? Resend
      </button>
    </div>
  );
}
