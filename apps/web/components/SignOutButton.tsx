/**
 * Sign-out button that fires a server action to call Auth.js's signOut.
 * Only meaningful in cloud mode — in local (desktop) mode there is no
 * session, so the parent layout should not render it.
 */
import { signOut } from '@/lib/nextauth';

async function signOutAction() {
  'use server';
  await signOut({ redirectTo: '/login' });
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-xs font-display uppercase tracking-wider text-charcoal/60 hover:text-glove transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
