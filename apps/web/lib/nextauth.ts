/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it —
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * (which reads AUTH_* env vars) never runs on the desktop.
 */
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from '@notomorrow/db-sqlite';
import { db } from './db';

function slugFromEmail(email: string): string {
  const localpart = email.split('@')[0] ?? 'user';
  const slug = localpart
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return slug || 'user';
}

async function chooseUniqueHandle(base: string, userId: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const existing = await db.query.users.findFirst({
      where: eq(users.handle, candidate),
    });
    if (!existing || existing.id === userId) return candidate;
  }
  // Extremely unlikely — the $defaultFn placeholder handle stays intact.
  return '';
}

// Cast because our `users` table has extra columns (handle, timezone,
// joinedAt, avatar) that the adapter's shape doesn't know about. The
// adapter only reads the columns it expects (id, name, email,
// emailVerified, image) — the extras are ignored on read and defaulted
// on insert via drizzle's $defaultFn.
export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  }),
  providers: [Google],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const base = slugFromEmail(user.email);
      const nice = await chooseUniqueHandle(base, user.id);
      if (!nice) return;
      await db.update(users).set({ handle: nice }).where(eq(users.id, user.id));
    },
  },
});
