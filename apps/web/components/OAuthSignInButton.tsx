'use client';

import { signIn } from 'next-auth/react';
import { useTransition, type ReactNode } from 'react';

export type OAuthProvider = 'google' | 'github' | 'microsoft-entra-id' | 'facebook';

interface Props {
  provider: OAuthProvider;
  label: string;
  next: string;
  /** Provider glyph (~18px square). */
  children: ReactNode;
}

/**
 * Shared "Continue with X" button used by every OAuth provider on the
 * login page. Same white surface + dark ink treatment regardless of
 * provider — the only per-provider bit is the glyph — so the stack of
 * options reads as a clean list rather than a patchwork of brand chrome.
 */
export function OAuthSignInButton({ provider, label, next, children }: Props) {
  const [pending, startTransition] = useTransition();

  const click = () => {
    startTransition(async () => {
      await signIn(provider, { callbackUrl: next });
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
      {children}
      {pending ? '…' : label}
    </button>
  );
}

/* ─────────────── Provider glyphs ─────────────── */

export function GoogleGlyph() {
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

export function GitHubGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="#181717">
      <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.25 9.28 7.77 10.79.57.1.78-.25.78-.55v-1.94c-3.16.69-3.82-1.52-3.82-1.52-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.52-.29-5.18-1.26-5.18-5.6 0-1.24.44-2.25 1.17-3.05-.12-.29-.51-1.44.11-3 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.56.23 2.71.11 3 .73.8 1.17 1.81 1.17 3.05 0 4.35-2.67 5.31-5.2 5.59.41.35.77 1.05.77 2.11v3.13c0 .3.21.66.79.55 4.51-1.51 7.76-5.77 7.76-10.79C23.33 5.56 18.27.5 12 .5Z" />
    </svg>
  );
}

// The four-square Microsoft logo — brand-official tile colors.
export function MicrosoftGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}

export function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}
