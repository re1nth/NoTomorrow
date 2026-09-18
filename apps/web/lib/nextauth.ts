/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it:
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * never runs on the desktop.
 *
 * Strategy: OAuth-only. Session strategy is `jwt` so the token can carry
 * our internal user id without a DB round-trip on every request.
 */
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Facebook from 'next-auth/providers/facebook';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { db } from './db';
import {
  hasFacebookOAuth,
  hasGitHubOAuth,
  hasGoogleOAuth,
  hasMicrosoftOAuth,
} from './oauth-config';

const providers: NextAuthConfig['providers'] = [];
const LINKABLE_EMAIL_PROVIDERS = new Set(['google', 'github']);

if (hasGoogleOAuth()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (hasGitHubOAuth()) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

if (hasMicrosoftOAuth()) {
  // Tenant `common` lets both personal Microsoft accounts and any
  // work/school tenant sign in. Override with
  // AUTH_MICROSOFT_ENTRA_ID_TENANT_ID for a single-tenant deployment.
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? 'common';
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    }),
  );
}

if (hasFacebookOAuth()) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
    }),
  );
}

export function hasTrustedOAuthEmail(provider: string | undefined, profile: unknown): boolean {
  if (!provider || !LINKABLE_EMAIL_PROVIDERS.has(provider)) return false;
  if (provider === 'google') {
    return (
      typeof profile === 'object' &&
      profile !== null &&
      'email_verified' in profile &&
      (profile as { email_verified: unknown }).email_verified === true
    );
  }
  // GitHub only exposes an email address to this flow when the authenticated
  // account has an email available to the OAuth profile/API response. Allowing
  // it here preserves same-email Google <-> GitHub sign-in without linking
  // less explicit providers by email.
  return provider === 'github';
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // First tick after an OAuth sign-in has `user` + `account`. The
      // provider's `user.id` is their id (Google sub, GitHub numeric,
      // etc.) and not useful as our PK. Link/create by email only for
      // providers whose email signal we explicitly trust.
      if (hasTrustedOAuthEmail(account?.provider, profile) && user?.email) {
        const email = user.email.trim().toLowerCase();
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) {
          token.sub = existing.id;
          const patch: Partial<typeof users.$inferInsert> = {};
          if (!existing.emailVerified) patch.emailVerified = new Date();
          if (!existing.name && user.name) patch.name = user.name;
          if (!existing.image && user.image) patch.image = user.image;
          if (Object.keys(patch).length > 0) {
            await db.update(users).set(patch).where(eq(users.id, existing.id));
          }
        } else {
          const [inserted] = await db
            .insert(users)
            .values({
              email,
              name: user.name ?? (typeof profile?.name === 'string' ? profile.name : null),
              image: user.image ?? null,
              emailVerified: new Date(),
            })
            .returning({ id: users.id });
          if (inserted) token.sub = inserted.id;
        }
      } else if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === 'string') {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
