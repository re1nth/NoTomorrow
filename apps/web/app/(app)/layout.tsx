import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LeftRail } from '@/components/LeftRail';
import { getUserId } from '@/lib/auth';

// Resolve the local user at request time — never prerender. Also keeps
// `next build` from touching the SQLite client: SQLITE_DB_PATH is set by
// the Electron launcher, not the build.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const uid = await getUserId();
  // The launcher's ensureLocalUser guarantees a row on boot; if it's
  // missing here the SQLite file is broken, not a sign-in issue.
  if (!uid) notFound();

  return (
    <div className="h-screen flex overflow-hidden">
      <LeftRail />
      <main className="flex-1 min-w-0 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
