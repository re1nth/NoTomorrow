/**
 * Auth.js (v5) instance used by cloud mode. Deliberately isolated in
 * its own module so `NOTOMORROW_AUTH=local` never has to import it —
 * `auth-cloud.ts` uses dynamic `import()` and this file's construction
 * (which reads AUTH_* env vars) never runs on the desktop.
 */
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { accounts, sessions, users, verificationTokens } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';
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

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function readBrowserTimeZone(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get('notomorrow_tz')?.value;
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  return isValidTimeZone(decoded) ? decoded : null;
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
      const tz = await readBrowserTimeZone();
      const patch: { handle?: string; timezone?: string } = {};
      if (nice) patch.handle = nice;
      if (tz) patch.timezone = tz;
      if (Object.keys(patch).length === 0) return;
      await db.update(users).set(patch).where(eq(users.id, user.id));
    },
  },
});
