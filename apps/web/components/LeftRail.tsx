import Link from 'next/link';

const links = [
  { href: '/gym', label: 'Gym' },
  { href: '/goals', label: 'Goals' },
  { href: '/rating', label: 'Rating' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * Persistent left navigation for the authenticated app shell.
 */
export function LeftRail() {
  return (
    <aside className="hidden md:flex flex-col w-48 border-r border-charcoal/10 bg-canvas-soft p-6 space-y-4">
      <div className="font-display text-2xl tracking-wider">NT</div>
      <nav className="flex flex-col gap-2">
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
    </aside>
  );
}
