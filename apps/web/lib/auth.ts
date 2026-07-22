/**
 * Single-user auth for the desktop runtime.
 *
 * The Electron launcher creates one local user on first boot (see
 * `apps/desktop/src/main/bootstrap.ts`) and every request is implicitly
 * that user. There is no sign-in surface.
 */
import { eq } from 'drizzle-orm';
import { users, DEMO_USER_ID } from '@notomorrow/db-sqlite';
import { db } from './db';

export async function getUserId(): Promise<string | null> {
  const row = await db.query.users.findFirst();
  return row?.id ?? null;
}

export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
}

export async function requireUser(): Promise<{ id: string; timezone: string }> {
  const id = await getUserId();
  if (!id) throw new UnauthorizedError('no local user');
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!row) throw new UnauthorizedError('user row missing');
  return { id: row.id, timezone: row.timezone };
}

export { DEMO_USER_ID };

/** Used by tests to bypass the user lookup. */
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
