import { z } from 'zod';

/**
 * Handle rules — kept intentionally strict so nothing that looks like a URL
 * fragment, an email localpart with `@`, or leading/trailing punctuation
 * can slip in.
 *
 *   - 3–24 characters
 *   - lowercase letters, digits, `_`, `-`
 *   - must start AND end with an alphanumeric (so no `_foo`, `foo-`)
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;
export const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/;

export const handleSchema = z
  .string()
  .min(HANDLE_MIN)
  .max(HANDLE_MAX)
  .regex(HANDLE_RE);

export function isValidHandle(value: string): boolean {
  return handleSchema.safeParse(value).success;
}

/** Everything the input pipeline should do to a raw form value. */
export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}
