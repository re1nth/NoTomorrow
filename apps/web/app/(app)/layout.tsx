import { CountersProvider } from '@/components/CountersStore';
import { LeftRail } from '@/components/LeftRail';
import { PomodoroProvider } from '@/components/PomodoroStore';
import { SignOutButton } from '@/components/SignOutButton';
import { getUserId } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

// Resolve the user at request time — never prerender. Also keeps
// `next build` from touching the SQLite client: SQLITE_DB_PATH is set by
// the launcher (or the Fly container), not the build.
export const dynamic = 'force-dynamic';

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const uid = await getUserId();
  if (!uid) {
    // Cloud: the visitor is signed out — send them to sign in.
    // Local (desktop): the launcher's ensureLocalUser guarantees a row
    // on boot, so a missing user means the SQLite file is broken.
    if (isCloud) redirect('/login');
    notFound();
  }

  return (
    <CountersProvider>
      <PomodoroProvider>
        <div className="h-screen flex overflow-hidden">
          <LeftRail signOutSlot={isCloud ? <SignOutButton /> : null} />
          {/* pt-20 on mobile clears the fixed hamburger bar; md+ uses the
              normal padding since the desktop rail sits in-flow. */}
          <main className="flex-1 min-w-0 px-6 pb-6 pt-20 md:pt-6 overflow-y-auto">{children}</main>
        </div>
      </PomodoroProvider>
    </CountersProvider>
  );
}
