'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode, type SVGProps } from 'react';
import { usePomodoro } from '@/components/PomodoroStore';

type NavLink = {
  href: string;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
};

function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const links: readonly NavLink[] = [
  { href: '/counters', label: 'Counters', Icon: CountersIcon },
  { href: '/pomodoro', label: 'Pomodoro', Icon: PomodoroIcon },
  { href: '/profile', label: 'Profile', Icon: ProfileIcon },
] as const;

const COLLAPSED_KEY = 'nt:leftRail:collapsed';

// Public GitHub repo — surfaced in the rail so anyone using the app can
// find their way to the source and contribute.
const REPO_URL = 'https://github.com/re1nth/NoTomorrow';

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
export function LeftRail({
  signOutAction,
}: {
  signOutAction: (() => Promise<void>) | null;
}) {
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
        <div className="font-display text-lg tracking-wider">Plus One</div>
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
        <div className="font-display text-xl tracking-wider mb-6">Plus One</div>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks onNavigate={() => setOpen(false)} pathname={pathname} />
        </nav>
        <div className="pt-4 border-t border-charcoal/10">
          <GitHubRow collapsed={false} />
        </div>
        {signOutAction ? (
          <div className="pt-4">
            <SignOutRow action={signOutAction} collapsed={false} />
          </div>
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
            <div className="font-display text-lg tracking-wider">Plus One</div>
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
        <div
          className={`w-full ${
            collapsed ? 'mt-4 flex justify-center' : 'pt-4 border-t border-charcoal/10'
          }`}
        >
          <GitHubRow collapsed={collapsed} />
        </div>
        {signOutAction ? (
          <div
            className={`w-full ${collapsed ? 'mt-3 flex justify-center' : 'pt-3'}`}
          >
            <SignOutRow action={signOutAction} collapsed={collapsed} />
          </div>
        ) : null}
      </aside>
    </>
  );
}

function GitHubRow({ collapsed }: { collapsed: boolean }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contribute on GitHub"
      title={collapsed ? 'Contribute on GitHub' : undefined}
      className={`flex items-center gap-3 rounded-md text-sm font-display uppercase tracking-wider text-charcoal/60 hover:text-glove transition-colors ${
        collapsed ? 'justify-center h-10 w-10' : 'px-1 py-1 w-full'
      }`}
    >
      <GitHubIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      {collapsed ? null : <span>GitHub</span>}
    </a>
  );
}

function SignOutRow({
  action,
  collapsed,
}: {
  action: () => Promise<void>;
  collapsed: boolean;
}) {
  return (
    <form action={action} className={collapsed ? undefined : 'w-full'}>
      <button
        type="submit"
        aria-label="Sign out"
        title={collapsed ? 'Sign out' : undefined}
        className={`flex items-center gap-3 rounded-md text-sm font-display uppercase tracking-wider text-charcoal/60 hover:text-glove transition-colors ${
          collapsed ? 'justify-center h-10 w-10' : 'px-1 py-1 w-full'
        }`}
      >
        <SignOutIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        {collapsed ? null : <span>Sign out</span>}
      </button>
    </form>
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
  // Read the pomodoro store here so the chip re-renders on every tick without
  // pulling the whole rail into the timer's render cycle when idle.
  const { mode, remainingMs } = usePomodoro();
  const timerRunning = mode === 'running';

  return (
    <>
      {links.map((l) => {
        const active = pathname === l.href || pathname?.startsWith(`${l.href}/`);
        const showTimerChip = l.href === '/pomodoro' && timerRunning && !collapsed;
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
            {collapsed ? null : (
              <>
                <span>{l.label}</span>
                {showTimerChip ? (
                  <span
                    className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-glove/10 text-glove text-[10px] tabular-nums normal-case tracking-normal"
                    aria-label={`Pomodoro running, ${formatMMSS(remainingMs)} remaining`}
                  >
                    <span
                      aria-hidden
                      className="w-1.5 h-1.5 rounded-full bg-glove animate-pulse"
                    />
                    {formatMMSS(remainingMs)}
                  </span>
                ) : null}
              </>
            )}
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

function ProfileIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.25 9.28 7.77 10.79.57.1.78-.25.78-.55v-1.94c-3.16.69-3.82-1.52-3.82-1.52-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.52-.29-5.18-1.26-5.18-5.6 0-1.24.44-2.25 1.17-3.05-.12-.29-.51-1.44.11-3 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.48 3.15-1.17 3.15-1.17.62 1.56.23 2.71.11 3 .73.8 1.17 1.81 1.17 3.05 0 4.35-2.67 5.31-5.2 5.59.41.35.77 1.05.77 2.11v3.13c0 .3.21.66.79.55 4.51-1.51 7.76-5.77 7.76-10.79C23.33 5.56 18.27.5 12 .5Z" />
    </svg>
  );
}

function SignOutIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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
