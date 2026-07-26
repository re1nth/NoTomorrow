/**
 * Cloud auth strategy — the hosted web runtime.
 *
 * Placeholder until Phase 2 wires Auth.js (Google OAuth). Selecting this
 * strategy today throws a clear error rather than silently reading from
 * the local users table.
 */
import { UnauthorizedError, type AuthStrategy } from './auth-strategy';

const NOT_WIRED =
  'cloud auth strategy is not wired yet — Phase 2 lands Auth.js';

export const cloudStrategy: AuthStrategy = {
  async getUserId(): Promise<string | null> {
    throw new UnauthorizedError(NOT_WIRED);
  },
  async requireUser() {
    throw new UnauthorizedError(NOT_WIRED);
  },
};
