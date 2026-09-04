/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it —
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * (which reads AUTH_* env vars) never runs on the desktop.
 *
 * Strategy: OAuth-only (Google, GitHub, Microsoft Entra ID, Facebook —
 * each opt-in via env). Session strategy is `jwt` so the id token can
 * carry our internal user id (looked up / created by email on first
 * login) without needing a DB round-trip on every request.
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
  // Tenant `common` lets both personal Microsoft accounts (outlook,
  // hotmail, live) and any work/school tenant sign in — the most
  // permissive option and the right default for a consumer app.
  // Override with AUTH_MICROSOFT_ENTRA_ID_TENANT_ID for a single-tenant
  // deployment.
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

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // First tick after an OAuth sign-in has `user` + `account`. The
      // provider's `user.id` is *their* id (Google sub, GitHub numeric,
      // etc.) — useless as our PK. Look up (or create) our row by email
      // and pin *our* id onto the token so every subsequent request can
      // recover it without a DB hit. Same-email across providers is
      // treated as the same person (implicit account linking).
      const isOAuth =
        account?.provider === 'google' ||
        account?.provider === 'github' ||
        account?.provider === 'microsoft-entra-id' ||
        account?.provider === 'facebook';
      if (isOAuth && user?.email) {
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
              // Every provider we accept releases the email only after
              // it's been verified on their side, so we don't require a
              // second verification round.
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
