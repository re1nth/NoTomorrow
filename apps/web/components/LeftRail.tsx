import Link from 'next/link';
import { SignOutButton } from './SignOutButton';

const links = [
  { href: '/counters', label: 'Counters' },
  { href: '/pomodoro', label: 'Pomodoro' },
  { href: '/settings', label: 'Settings' },
] as const;

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

/**
 * Persistent left navigation for the authenticated app shell.
 */
export function LeftRail() {
  return (
    <aside className="hidden md:flex flex-col w-48 border-r border-charcoal/10 bg-canvas-soft p-6">
      <div className="font-display text-2xl tracking-wider mb-4">NT</div>
      <nav className="flex flex-col gap-2 flex-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-display uppercase tracking-wider text-charcoal hover:text-glove transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {isCloud ? (
        <div className="pt-4 border-t border-charcoal/10">
          <SignOutButton />
        </div>
      ) : null}
    </aside>
  );
}
