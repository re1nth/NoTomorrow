'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const PasswordStrengthMeter = dynamic(
  () => import('./PasswordStrengthMeter').then((m) => m.PasswordStrengthMeter),
  { ssr: false },
);

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [weakness, setWeakness] = useState<{
    warning: string;
    suggestions: string[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setWeakness(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        suggestions?: string[];
      };
      if (!res.ok) {
        if (body.warning || body.suggestions?.length) {
          setWeakness({
            warning: body.warning ?? '',
            suggestions: body.suggestions ?? [],
          });
        }
        setError(body.error ?? 'Reset failed.');
        return;
      }
      router.push('/login?reset=1');
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
        />
      </label>
      <PasswordStrengthMeter password={password} userInputs={[]} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
        />
      </label>

      {error ? (
        <div className="text-sm text-red-400 space-y-1">
          <p>{error}</p>
          {weakness?.warning ? <p className="text-xs">{weakness.warning}</p> : null}
          {weakness?.suggestions?.length ? (
            <ul className="text-xs text-white/60 list-disc pl-4">
              {weakness.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-[#E63946] text-white
                   px-6 py-3 text-base font-medium
                   hover:bg-[#E63946]/90 transition-colors disabled:opacity-60
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {pending ? '…' : 'Reset password'}
      </button>
    </form>
  );
}
