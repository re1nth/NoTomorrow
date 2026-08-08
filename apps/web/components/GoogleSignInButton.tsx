'use client';

import { signIn } from 'next-auth/react';
import { useTransition } from 'react';

interface Props {
  next: string;
  label?: string;
}

export function GoogleSignInButton({ next, label = 'Continue with Google' }: Props) {
  const [pending, startTransition] = useTransition();

  const click = () => {
    startTransition(async () => {
      await signIn('google', { callbackUrl: next });
    });
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className="inline-flex w-full max-w-sm items-center justify-center gap-3 rounded-md
                 bg-white text-charcoal-ink border border-black/10 px-6 py-3 text-base font-medium
                 shadow-[0_1px_2px_rgba(0,0,0,0.35)]
                 hover:bg-white/95 transition-colors disabled:opacity-60
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <GoogleGlyph />
      {pending ? '…' : label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
