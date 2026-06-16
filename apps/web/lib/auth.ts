/**
 * next-auth v4 with JWT session strategy.
 *
 * On first sign-in we upsert into the existing `users` table (handle derived
 * from the email local-part). We skip the Drizzle adapter on purpose: the
 * `users` schema doesn't carry next-auth's expected columns, and JWT mode
 * keeps the route handlers stateless.
 *
 * Decision approved in PLAN — do not re-debate.
 */
import { and, eq } from 'drizzle-orm';
import type { AuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { users, DEMO_USER_ID } from '@notomorrow/db';
import { db } from './db';
import { env } from './env';

/**
 * Pick a handle from an email local-part. We force [a-z0-9_-], min length 2.
 */
function handleFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  const cleaned = local.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
  return cleaned.length >= 2 ? cleaned : `user-${cleaned}`;
}

/**
 * Find-or-create the User row keyed by handle. We can't key by email
 * because the schema doesn't store email — handle is the closest stable
 * identifier we can derive deterministically.
 */
export async function upsertUserByEmail(email: string): Promise<string> {
  const handle = handleFromEmail(email);
  const existing = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(users)
    .values({ handle, timezone: 'UTC' })
    .returning({ id: users.id });
  if (!row) throw new Error('User insert returned no row');
  return row.id;
}

const providers: AuthOptions['providers'] = [
  // Always-on dev credentials provider so the local flow works without an
  // email server. Production should remove this via env.
  CredentialsProvider({
    id: 'dev',
    name: 'Demo (dev only)',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'demo@notomorrow.dev' },
    },
    async authorize(creds) {
      const email = creds?.email?.toString().trim();
      if (!email) return null;
      const userId = await upsertUserByEmail(email);
      return { id: userId, email, name: handleFromEmail(email) };
    },
  }),
];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

// EmailProvider requires an SMTP server; skip unless explicitly configured.
if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  );
}

export const authOptions: AuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  secret: env.NEXTAUTH_SECRET,
  debug: process.env.NOTOMORROW_RUNTIME === 'desktop',
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, ensure the DB row exists and stash its id.
      if (user) {
        const email = user.email ?? `${user.name ?? 'user'}@notomorrow.dev`;
        token.uid = (user as { id?: string }).id ?? (await upsertUserByEmail(email));
      } else if (!token.uid && token.email) {
        token.uid = await upsertUserByEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
};

/**
 * Look up the current user's id from the session. Returns null if
 * unauthenticated — route handlers should respond 401 in that case.
 *
 * Desktop runtime short-circuits to the single local user (created at boot
 * by `apps/desktop/src/main`). This skips NextAuth entirely — there is no
 * sign-in screen in the packaged app.
 */
export async function getUserId(): Promise<string | null> {
  if (process.env.NOTOMORROW_RUNTIME === 'desktop') {
    const row = await db.query.users.findFirst();
    return row?.id ?? null;
  }
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ?? null;
}

/**
 * Convenience: throw a typed 401 sentinel if no user is signed in.
 */
export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
}

export async function requireUser(): Promise<{ id: string; timezone: string }> {
  const id = await getUserId();
  if (!id) throw new UnauthorizedError('not authenticated');
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!row) throw new UnauthorizedError('user row missing');
  return { id: row.id, timezone: row.timezone };
}

/** Re-export the seeded demo id so tests can monkey-patch sessions. */
export { DEMO_USER_ID };

/** Used by tests to bypass the session lookup. */
declare global {
  // eslint-disable-next-line no-var
  var __testUserId: string | undefined;
}

export async function requireUserOrTest(): Promise<{ id: string; timezone: string }> {
  if (global.__testUserId) {
    return { id: global.__testUserId, timezone: 'UTC' };
  }
  return requireUser();
}

// Augment next-auth's session shape so callers can do `session.user.id`.
declare module 'next-auth' {
  interface Session {
    user?: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

// Suppress unused import warning for `and` if we drop the join later.
void and;
