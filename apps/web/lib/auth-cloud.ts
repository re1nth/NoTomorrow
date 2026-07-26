/**
 * Cloud auth strategy — reads the Auth.js session cookie via the
 * NextAuth instance in `nextauth.ts`. Dynamic import keeps the
 * NextAuth() construction out of local (desktop) mode entirely.
 */
import { eq } from 'drizzle-orm';
import { users } from '@notomorrow/db-sqlite';
import { db } from './db';
import { UnauthorizedError, type AuthStrategy, type AuthUser } from './auth-strategy';

async function currentSessionUserId(): Promise<string | null> {
  const { auth } = await import('./nextauth');
  const session = await auth();
  return session?.user?.id ?? null;
}

async function getUserId(): Promise<string | null> {
  return currentSessionUserId();
}

async function requireUser(): Promise<AuthUser> {
  const id = await currentSessionUserId();
  if (!id) throw new UnauthorizedError('not signed in');
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!row) throw new UnauthorizedError('user row missing');
  return { id: row.id, timezone: row.timezone };
}

export const cloudStrategy: AuthStrategy = {
  getUserId,
  requireUser,
};
