/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it —
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * (which reads AUTH_* env vars) never runs on the desktop.
 *
 * Strategy: Google OAuth only. Session strategy is `jwt` so the id
 * token can carry our internal user id (looked up / created by email
 * on first login) without needing a DB round-trip on every request.
 */
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from './db';
import { hasGoogleOAuth } from './oauth-config';

const providers: NextAuthConfig['providers'] = [];

if (hasGoogleOAuth()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
      // First tick after Google sign-in has `user` + `account`. Google's
      // id is useless as our PK — look up (or create) our row by email
      // and pin *our* id onto the token so every subsequent request can
      // recover it without a DB hit.
      if (account?.provider === 'google' && user?.email) {
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
              // Google verifies email before releasing it in the id_token.
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
