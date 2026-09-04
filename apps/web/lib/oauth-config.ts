/**
 * Which OAuth providers have real credentials wired up. Values starting
 * with `placeholder…` (shipped in .env.example) are treated as "not
 * configured" so the sign-in UI never offers a button that would fail
 * at the provider's consent screen.
 */

function isConfigured(id: string | undefined, secret: string | undefined): boolean {
  if (!id || !secret) return false;
  if (id.startsWith('placeholder') || secret.startsWith('placeholder')) return false;
  return true;
}

export function hasGoogleOAuth(): boolean {
  return isConfigured(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET);
}

export function hasGitHubOAuth(): boolean {
  return isConfigured(process.env.AUTH_GITHUB_ID, process.env.AUTH_GITHUB_SECRET);
}

export function hasMicrosoftOAuth(): boolean {
  return isConfigured(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  );
}

export function hasFacebookOAuth(): boolean {
  return isConfigured(process.env.AUTH_FACEBOOK_ID, process.env.AUTH_FACEBOOK_SECRET);
}

export function hasAnyOAuth(): boolean {
  return hasGoogleOAuth() || hasGitHubOAuth() || hasMicrosoftOAuth() || hasFacebookOAuth();
}
