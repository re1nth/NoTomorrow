'use client';

/**
 * Email + password form shared by /login and /register.
 *
 * Login: hits Auth.js's Credentials callback and pushes the user
 * forward on success. Failed sign-in always shows a generic message
 * (no enumeration) plus a "just signed up?" link to /verify-email so
 * users who haven't verified can self-serve.
 *
 * Register: POSTs /api/auth/register. On success the server returns
 * `{ needsVerification: true, email }` and we send the user to
 * /verify-email — no auto-signin, since the account can't log in until
 * the emailed code is entered.
 */
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState, useTransition } from 'react';

// zxcvbn + dictionaries are ~700KB — only load them on /register so
// the /login route stays lean.
const PasswordStrengthMeter = dynamic(
  () => import('./PasswordStrengthMeter').then((m) => m.PasswordStrengthMeter),
  { ssr: false },
);

interface Props {
  mode: 'login' | 'register';
  next: string;
  initialFlash?: string | null;
}

export function CredentialsForm({ mode, next, initialFlash }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialFlash ?? null);
  const [weakness, setWeakness] = useState<{
    warning: string;
    suggestions: string[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setInfo(initialFlash ?? null);
  }, [initialFlash]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setWeakness(null);

    startTransition(async () => {
      if (mode === 'register') {
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
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          needsVerification?: boolean;
          email?: string;
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
          setError(body.error ?? 'Signup failed. Try again.');
          return;
        }
        if (body.needsVerification && body.email) {
          const nextParam = next && next !== '/counters' ? `&next=${encodeURIComponent(next)}` : '';
          router.push(`/verify-email?email=${encodeURIComponent(body.email)}${nextParam}`);
          return;
        }
        setError('Unexpected response from server.');
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError('Invalid email or password.');
        return;
      }
      router.push(next);
      router.refresh();
    });
  };

  const verifyHref =
    email && /.+@.+/.test(email)
      ? `/verify-email?email=${encodeURIComponent(email)}`
      : '/verify-email';

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

      {mode === 'register' ? (
        <PasswordStrengthMeter password={password} userInputs={[email]} />
      ) : null}

      {error ? (
        <div className="text-sm text-red-400 space-y-1">
          <p>{error}</p>
          {/* On register the client meter already renders warning + suggestions;
              only echo them for login mode where there's no meter. */}
          {mode === 'login' && weakness?.warning ? (
            <p className="text-xs">{weakness.warning}</p>
          ) : null}
          {mode === 'login' && weakness?.suggestions?.length ? (
            <ul className="text-xs text-white/60 list-disc pl-4">
              {weakness.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          {mode === 'login' ? (
            <p className="text-xs text-white/60">
              Just signed up?{' '}
              <Link href={verifyHref} className="text-[#E63946] hover:underline">
                Verify your email
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}
      {info ? <p className="text-sm text-white/60">{info}</p> : null}

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
