import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { BellToggle } from '@/components/BellToggle';
import { LeftRail } from '@/components/LeftRail';
import { getUserId } from '@/lib/auth';

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
          <BellToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
