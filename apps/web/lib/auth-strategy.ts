/**
 * Contract shared by every auth strategy. The desktop runtime and the
 * hosted web runtime both plug in here; route handlers depend only on
 * this shape, not on which strategy is active.
 */
export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
}

export interface AuthUser {
  id: string;
  timezone: string;
}

export interface AuthStrategy {
  getUserId(): Promise<string | null>;
  requireUser(): Promise<AuthUser>;
}
