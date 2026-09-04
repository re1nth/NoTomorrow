import { CountersProvider } from '@/components/CountersStore';
import { EasterAccessProvider } from '@/components/EasterAccessProvider';
import { LeftRail } from '@/components/LeftRail';
import { PomodoroProvider } from '@/components/PomodoroStore';
import { getUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasEasterAccess } from '@/lib/easter-access';
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
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

  // Pass the sign-out server action down to LeftRail so the rail can
  // render its own button in both expanded and collapsed variants
  // (icon+label vs. icon only). Only wired in cloud mode — desktop has
  // no session to sign out of.
  const signOutAction = isCloud
    ? async () => {
        'use server';
        const { signOut } = await import('@/lib/nextauth');
        await signOut({ redirectTo: '/' });
      }
    : null;

  // Server-side feature-flag check. Only a boolean crosses the RSC
  // boundary; the hashing logic in lib/easter-access.ts never ships to
  // the client.
  const row = await db.query.users.findFirst({
    where: eq(users.id, uid),
    columns: { email: true },
  });
  const easterEnabled = hasEasterAccess(row?.email);

  return (
    <EasterAccessProvider enabled={easterEnabled}>
      <CountersProvider>
        <PomodoroProvider>
          <div className="h-screen flex overflow-hidden">
            <LeftRail signOutAction={signOutAction} />
            {/* pt-20 on mobile clears the fixed hamburger bar; md+ uses the
                normal padding since the desktop rail sits in-flow. */}
            <main className="flex-1 min-w-0 px-6 pb-6 pt-20 md:pt-6 overflow-y-auto">{children}</main>
          </div>
        </PomodoroProvider>
      </CountersProvider>
    </EasterAccessProvider>
  );
}
