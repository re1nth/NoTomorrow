'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const links = [
  { href: '/counters', label: 'Counters' },
  { href: '/pomodoro', label: 'Pomodoro' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * App shell navigation.
 *
 * Desktop (md+): a persistent left rail — the classic vertical sidebar.
 * Mobile: a fixed top bar with a hamburger that opens a slide-in drawer
 * carrying the same links. Sign-out (cloud only) is passed in as a slot
 * so this component can stay a client component without touching the
 * server-only `signOut` import.
 */
export function LeftRail({ signOutSlot }: { signOutSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar — fixed so it never eats scroll space. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-canvas-soft border-b border-charcoal/10">
        <div className="font-display text-xl tracking-wider">NT</div>
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-md hover:bg-charcoal/5 transition-colors"
        >
          <span
            className={`block w-5 h-[2px] bg-charcoal transition-transform ${
              open ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-5 h-[2px] bg-charcoal transition-opacity ${
              open ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block w-5 h-[2px] bg-charcoal transition-transform ${
              open ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {/* Scrim — dismiss on tap. */}
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
        />
      ) : null}

      {/* Mobile drawer. */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-canvas-soft border-r border-charcoal/10 p-6 flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="font-display text-2xl tracking-wider mb-6">NT</div>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks onNavigate={() => setOpen(false)} pathname={pathname} />
        </nav>
        {signOutSlot ? (
          <div className="pt-4 border-t border-charcoal/10">{signOutSlot}</div>
        ) : null}
      </aside>

      {/* Desktop rail. */}
      <aside className="hidden md:flex flex-col w-48 border-r border-charcoal/10 bg-canvas-soft p-6">
        <div className="font-display text-2xl tracking-wider mb-4">NT</div>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks pathname={pathname} />
        </nav>
        {signOutSlot ? (
          <div className="pt-4 border-t border-charcoal/10">{signOutSlot}</div>
        ) : null}
      </aside>
    </>
  );
}

function NavLinks({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string | null;
}) {
  return (
    <>
      {links.map((l) => {
        const active = pathname === l.href || pathname?.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={`text-sm font-display uppercase tracking-wider transition-colors ${
              active ? 'text-glove' : 'text-charcoal hover:text-glove'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
