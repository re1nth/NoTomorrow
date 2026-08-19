'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode, type SVGProps } from 'react';

type NavLink = {
  href: string;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
};

const links: readonly NavLink[] = [
  { href: '/counters', label: 'Counters', Icon: CountersIcon },
  { href: '/pomodoro', label: 'Pomodoro', Icon: PomodoroIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
] as const;

const COLLAPSED_KEY = 'nt:leftRail:collapsed';

/**
 * App shell navigation.
 *
 * Desktop (md+): a persistent left rail — expanded shows icon + label,
 * collapsed shows icons only. A chevron button toggles between the two
 * and the preference is persisted in localStorage.
 * Mobile: a fixed top bar with a hamburger that opens a slide-in drawer
 * carrying the same links. Sign-out (cloud only) is passed in as a slot
 * so this component can stay a client component without touching the
 * server-only `signOut` import.
 */
export function LeftRail({ signOutSlot }: { signOutSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === '1') setCollapsed(true);
    } catch {
      // localStorage unavailable (private mode, etc.) — stick with default.
    }
  }, []);

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

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <>
      {/* Mobile top bar — fixed so it never eats scroll space. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-canvas-soft border-b border-charcoal/10">
        <div className="font-display text-xl tracking-wider">P1</div>
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
        <div className="font-display text-2xl tracking-wider mb-6">+1</div>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks onNavigate={() => setOpen(false)} pathname={pathname} />
        </nav>
        {signOutSlot ? (
          <div className="pt-4 border-t border-charcoal/10">{signOutSlot}</div>
        ) : null}
      </aside>

      {/* Desktop rail. */}
      <aside
        className={`hidden md:flex flex-col border-r border-charcoal/10 bg-canvas-soft py-6 transition-[width] duration-200 ease-out ${
          collapsed ? 'w-16 px-2 items-center' : 'w-48 px-6'
        }`}
      >
        <div
          className={`flex items-center mb-4 ${collapsed ? 'justify-center' : 'justify-between'}`}
        >
          {collapsed ? null : (
            <div className="font-display text-2xl tracking-wider">P1</div>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            className="w-8 h-8 flex items-center justify-center rounded-md text-charcoal/60 hover:text-glove hover:bg-charcoal/5 transition-colors"
          >
            <ChevronIcon
              className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        <nav className="flex flex-col gap-2 flex-1 w-full">
          <NavLinks pathname={pathname} collapsed={collapsed} />
        </nav>
        {signOutSlot && !collapsed ? (
          <div className="pt-4 border-t border-charcoal/10 w-full">{signOutSlot}</div>
        ) : null}
      </aside>
    </>
  );
}

function NavLinks({
  onNavigate,
  pathname,
  collapsed = false,
}: {
  onNavigate?: () => void;
  pathname: string | null;
  collapsed?: boolean;
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
            aria-label={collapsed ? l.label : undefined}
            title={collapsed ? l.label : undefined}
            className={`flex items-center gap-3 rounded-md text-sm font-display uppercase tracking-wider transition-colors ${
              collapsed ? 'justify-center h-10 w-10 self-center' : 'px-1 py-1'
            } ${active ? 'text-glove' : 'text-charcoal hover:text-glove'} ${
              collapsed && active ? 'bg-charcoal/5' : ''
            }`}
          >
            <l.Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {collapsed ? null : <span>{l.label}</span>}
          </Link>
        );
      })}
    </>
  );
}

function CountersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-8" />
    </svg>
  );
}

function PomodoroIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
