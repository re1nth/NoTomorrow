'use client';

/**
 * Email + password form shared by /login and /register.
 *
 * On submit it hits the appropriate endpoint (Auth.js's Credentials
 * callback for login, our /api/auth/register for signup) and pushes the
 * user forward. Also snapshots the browser's IANA timezone into a
 * short-lived cookie before signup so the server-side handler can seed
 * `users.timezone` for a new account.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

interface Props {
  mode: 'login' | 'register';
  next: string;
}

export function CredentialsForm({ mode, next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === 'register') {
        // Capture the browser timezone so the server can seed users.timezone.
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            document.cookie = `notomorrow_tz=${encodeURIComponent(tz)}; Path=/; Max-Age=600; SameSite=Lax`;
          }
        } catch {
          // Older browsers — user gets UTC and can change it later.
        }
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'Signup failed. Try again.');
          return;
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError(
          mode === 'register'
            ? 'Account created but sign-in failed. Try logging in.'
            : 'Invalid email or password.',
        );
        return;
      }
      router.push(next);
      router.refresh();
    });
  };

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
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">Password</span>
        <input
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-[#E63946] text-white
                   px-6 py-3 text-base font-medium
                   hover:bg-[#E63946]/90 transition-colors disabled:opacity-60
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {pending ? '…' : mode === 'register' ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}
