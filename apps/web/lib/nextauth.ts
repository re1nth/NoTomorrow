import { users } from '@notomorrow/db-sqlite';
/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it —
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * (which reads AUTH_* env vars) never runs on the desktop.
 *
 * Strategy: email + password via the Credentials provider, backed by a
 * bcrypt hash in `users.password_hash`. Session strategy is `jwt` —
 * Credentials logins can't use database sessions in Auth.js (the
 * adapter's createSession never fires for them), so we mint a signed
 * JWT with the user id and rehydrate it in the session callback.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from './db';
import { hasGoogleOAuth } from './oauth-config';

/**
 * Thrown from `authorize()` when the password is correct but the account
 * hasn't verified its email. The `code` string surfaces on the client as
 * `result.code` from signIn('credentials', { redirect: false }), and the
 * login form uses it to bounce the user to /verify-email instead of
 * showing a generic "invalid credentials" error.
 *
 * This does leak "credentials correct but unverified" to a caller — for
 * a habit tracker with no sensitive account state that's the right
 * tradeoff for usable sign-in.
 */
class EmailNotVerifiedError extends CredentialsSignin {
  override code = 'email_not_verified';
}

const providers: NextAuthConfig['providers'] = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email =
        typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
      const password = typeof credentials?.password === 'string' ? credentials.password : '';
      if (!email || !password) return null;
      const row = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (!row?.passwordHash) return null;
      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) return null;
      if (!row.emailVerified) throw new EmailNotVerifiedError();
      return { id: row.id, email: row.email, name: row.name };
    },
  }),
];

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
      // First tick after sign-in has `user` + `account`. For Credentials
      // logins we already have our internal id in `user.id`. For Google
      // we get Google's id, which is useless as a PK — look up (or
      // create) our row by email and pin *our* id onto the token so
      // every subsequent request can recover it without a DB hit.
      if (account?.provider === 'google' && user?.email) {
        const email = user.email.trim().toLowerCase();
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) {
          token.sub = existing.id;
          // Backfill fields Google gives us but earlier flows may have
          // left null (e.g. a Credentials account that later linked
          // Google, or a legacy adapter row).
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
              // Google verifies email before releasing it in the id_token,
              // so a fresh Google sign-in never needs the /verify-email step.
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
