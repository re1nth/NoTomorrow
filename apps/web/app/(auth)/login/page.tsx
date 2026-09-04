import {
  FacebookGlyph,
  GitHubGlyph,
  GoogleGlyph,
  MicrosoftGlyph,
  OAuthSignInButton,
} from '@/components/OAuthSignInButton';
import { getUserId } from '@/lib/auth';
import {
  hasAnyOAuth,
  hasFacebookOAuth,
  hasGitHubOAuth,
  hasGoogleOAuth,
  hasMicrosoftOAuth,
} from '@/lib/oauth-config';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Kept out of `/` so the landing page renders no credential inputs —
// browser reputation classifiers (Safe Browsing) flag a bare domain
// whose root is a sign-in form as phishing-shaped.
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const uid = await getUserId();
  if (uid) redirect(safeNext(next));

  const safe = safeNext(next);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6 py-16">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        <Link href="/" className="flex flex-col items-center gap-3">
          <h1
            className="font-display text-[#E63946] leading-[0.82] tracking-[0.02em] text-left
                       text-6xl md:text-7xl
                       drop-shadow-[0_0_30px_rgba(230,57,70,0.35)]"
            style={{ WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}
          >
            <span className="block">PLUS</span>
            <span className="block pl-[0.9em] mt-3 md:mt-4">ONE</span>
          </h1>
          <div
            className="h-1.5 w-40 md:w-56 bg-[#E63946] rounded-sm"
            style={{ boxShadow: '0 0 18px rgba(230,57,70,0.55)' }}
          />
        </Link>
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          {hasGoogleOAuth() ? (
            <OAuthSignInButton provider="google" label="Continue with Google" next={safe}>
              <GoogleGlyph />
            </OAuthSignInButton>
          ) : null}
          {hasGitHubOAuth() ? (
            <OAuthSignInButton provider="github" label="Continue with GitHub" next={safe}>
              <GitHubGlyph />
            </OAuthSignInButton>
          ) : null}
          {hasMicrosoftOAuth() ? (
            <OAuthSignInButton
              provider="microsoft-entra-id"
              label="Continue with Microsoft"
              next={safe}
            >
              <MicrosoftGlyph />
            </OAuthSignInButton>
          ) : null}
          {hasFacebookOAuth() ? (
            <OAuthSignInButton provider="facebook" label="Continue with Facebook" next={safe}>
              <FacebookGlyph />
            </OAuthSignInButton>
          ) : null}
          {!hasAnyOAuth() ? (
            <p className="text-sm text-white/70 text-center">
              Sign-in is temporarily unavailable — no OAuth providers are configured on this
              deployment.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/counters';
  }
  return next;
}
