'use client';

import { useState, useTransition } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <p className="text-sm text-white/70 text-center max-w-sm">
        If an account exists for <span className="text-white">{email}</span>, a
        password-reset link is on its way. Check your inbox and spam folder.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-[#E63946] text-white
                   px-6 py-3 text-base font-medium
                   hover:bg-[#E63946]/90 transition-colors disabled:opacity-60
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {pending ? '…' : 'Send reset link'}
      </button>
    </form>
  );
}
