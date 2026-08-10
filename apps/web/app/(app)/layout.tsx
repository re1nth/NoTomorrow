import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LeftRail } from '@/components/LeftRail';
import { getUserId } from '@/lib/auth';

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
    if (isCloud) redirect('/');
    notFound();
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <LeftRail />
      <main className="flex-1 min-w-0 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
