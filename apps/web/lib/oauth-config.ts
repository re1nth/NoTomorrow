/**
 * Whether real Google OAuth credentials are wired up. Treats the
 * `placeholder…` values shipped in .env.local as "not configured" so
 * the sign-in UI doesn't offer a button that will fail at the Google
 * consent screen.
 */
export function hasGoogleOAuth(): boolean {
  const id = process.env.AUTH_GOOGLE_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET;
  if (!id || !secret) return false;
  if (id.startsWith('placeholder') || secret.startsWith('placeholder')) return false;
  return true;
}
