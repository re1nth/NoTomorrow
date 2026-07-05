import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LeftRail } from '@/components/LeftRail';
import { getUserId } from '@/lib/auth';

// Authenticated routes resolve identity from session (web) or sqlite (desktop)
// at request time — never prerender them statically. In desktop builds this
// also keeps `next build` from touching the SQLite client (no SQLITE_DB_PATH
// is set until the launcher boots).
export const dynamic = 'force-dynamic';

/**
 * Authenticated shell. Redirects to /sign-in if no session.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const uid = await getUserId();
  if (!uid) redirect('/sign-in');

  return (
    <div className="min-h-screen flex">
      <LeftRail />
      <div className="flex-1 flex flex-col">
        <header className="flex justify-between items-center px-6 py-3 border-b border-charcoal/10 bg-canvas-soft">
          <div className="font-display uppercase tracking-wider text-sm text-charcoal-soft">
            No Tomorrow
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
