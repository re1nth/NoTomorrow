import { redirect } from 'next/navigation';
import { SignInForm } from './SignInForm';

/**
 * Sign-in route.
 *
 * In desktop runtime there is no sign-in — the Electron main process boots
 * the app with a single auto-created local user (see `apps/desktop/src/main/
 * bootstrap.ts`). Redirecting here keeps users from landing on a dead-end
 * form whose authorize() handler would just no-op against the same local
 * user that's already implicitly signed in.
 *
 * Web mode keeps the email form unchanged.
 *
 * `dynamic = 'force-dynamic'` is required because the runtime check below
 * happens at request time, not build time. Without this, Next would
 * statically pre-render the page using the build-time env (no
 * NOTOMORROW_RUNTIME set) and bake in the web-only branch forever.
 */
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (process.env.NOTOMORROW_RUNTIME === 'desktop') {
    redirect('/gym');
  }
  return (
    <main className="sunset-hero min-h-screen flex items-center justify-center px-6 py-16">
      <SignInForm />
    </main>
  );
}
