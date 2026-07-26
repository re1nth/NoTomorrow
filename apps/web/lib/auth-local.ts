/**
 * Local auth strategy — the desktop runtime.
 *
 * The Electron launcher creates a single local user on first boot (see
 * `apps/desktop/src/main/bootstrap.ts`) and every request is implicitly
 * that user. There is no sign-in surface.
 */
import { eq } from 'drizzle-orm';
import { users } from '@notomorrow/db-sqlite';
import { db } from './db';
import { UnauthorizedError, type AuthStrategy, type AuthUser } from './auth-strategy';

async function getUserId(): Promise<string | null> {
  const row = await db.query.users.findFirst();
  return row?.id ?? null;
}

async function requireUser(): Promise<AuthUser> {
  const id = await getUserId();
  if (!id) throw new UnauthorizedError('no local user');
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!row) throw new UnauthorizedError('user row missing');
  return { id: row.id, timezone: row.timezone };
}

export const localStrategy: AuthStrategy = {
  getUserId,
  requireUser,
};
