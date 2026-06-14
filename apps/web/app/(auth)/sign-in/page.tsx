'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button, Card } from '@/lib/ui';

/**
 * Sign-in surface. Renders whatever providers are wired up server-side.
 *
 * For MVP we always show the dev/credentials path so the golden flow works
 * locally without an SMTP server or OAuth keys.
 */
export default function SignInPage() {
  const [email, setEmail] = useState('demo@notomorrow.dev');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await signIn('dev', { email, callbackUrl: '/onboarding' });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md" tone="glove">
        <h1 className="font-display text-3xl mb-1">Step into the ring</h1>
        <p className="text-sm text-charcoal-soft mb-6">
          Sign in with email. We&apos;ll create your account on first visit.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            <span className="block mb-1 uppercase tracking-wider text-xs">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove"
            />
          </label>
          <Button type="submit" variant="primary" size="lg" block disabled={pending}>
            {pending ? 'Lacing up…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-xs text-charcoal-soft">
          Google sign-in available when configured server-side.
        </p>
      </Card>
    </main>
  );
}
