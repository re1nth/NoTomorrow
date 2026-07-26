/**
 * Public auth surface for route handlers and layouts. Picks a strategy
 * from `NOTOMORROW_AUTH` (local or cloud) at module load; the seam is
 * documented in `docs/web-hosting-plan.md` §4.
 */
import { DEMO_USER_ID } from '@notomorrow/db-sqlite';
import { cloudStrategy } from './auth-cloud';
import { localStrategy } from './auth-local';
import { UnauthorizedError, type AuthStrategy, type AuthUser } from './auth-strategy';

const strategy: AuthStrategy =
  process.env.NOTOMORROW_AUTH === 'cloud' ? cloudStrategy : localStrategy;

export async function getUserId(): Promise<string | null> {
  return strategy.getUserId();
}

export async function requireUser(): Promise<AuthUser> {
  return strategy.requireUser();
}

export { UnauthorizedError, DEMO_USER_ID };

/** Used by tests to bypass the user lookup. */
declare global {
  // eslint-disable-next-line no-var
  var __testUserId: string | undefined;
}

export async function requireUserOrTest(): Promise<AuthUser> {
  if (global.__testUserId) {
    return { id: global.__testUserId, timezone: 'UTC' };
  }
  return requireUser();
}
