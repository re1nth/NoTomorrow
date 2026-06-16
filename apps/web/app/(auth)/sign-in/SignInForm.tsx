'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button, Card } from '@/lib/ui';

/**
 * Sign-in form. Used in web mode. The desktop runtime skips this surface
 * entirely (see `page.tsx` — desktop redirects to /gym).
 */
export function SignInForm() {
  const [email, setEmail] = useState('demo@notomorrow.dev');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await signIn('dev', { email, callbackUrl: '/onboarding' });
  }

  return (
    <Card
      className="w-full max-w-md bg-canvas/85 backdrop-blur-md border border-charcoal-soft/20 shadow-ring"
      tone="glove"
    >
      <h1 className="font-display text-3xl mb-1 text-charcoal">
        Step into the ring
      </h1>
      <p className="text-sm text-charcoal-soft mb-6">
        Sign in with email. We&apos;ll create your account on first visit.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-charcoal">
          <span className="block mb-1 uppercase tracking-wider text-xs text-sunset-amber">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-glove border border-charcoal-soft/30 bg-canvas-deep px-3 py-2 text-base text-charcoal placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-sunset-coral"
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
  );
}
