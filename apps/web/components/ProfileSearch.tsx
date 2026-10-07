'use client';

import { useEffect, useRef, useState } from 'react';

type Hit = { id: string; handle: string };

export function ProfileSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Abort in-flight requests when a newer keystroke supersedes them, so the
  // list never flashes stale results from a slower earlier query.
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      inflight.current?.abort();
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setLoading(true);
      setError(null);
      fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error(`search failed (${r.status})`);
          return (await r.json()) as { results: Hit[] };
        })
        .then((data) => {
          setHits(data.results);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setError(err?.message ?? 'search failed');
          setLoading(false);
        });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const trimmed = q.trim();
  const showEmpty = !loading && !error && trimmed.length > 0 && hits.length === 0;

  return (
    <div className="max-w-sm">
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-soft"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search handles"
          aria-label="Search handles"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-md border border-charcoal/20 bg-canvas py-1 pl-7 pr-2 text-xs text-charcoal placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-glove"
        />
      </div>

      {trimmed.length > 0 ? (
        <div className="mt-2 rounded-md border border-charcoal/10 bg-canvas text-xs">
          {loading ? (
            <div className="px-2 py-1.5 text-charcoal-soft">Searching…</div>
          ) : error ? (
            <div className="px-2 py-1.5 text-[#E63946]">{error}</div>
          ) : showEmpty ? (
            <div className="px-2 py-1.5 text-charcoal-soft">No profiles match.</div>
          ) : (
            <ul className="divide-y divide-charcoal/10">
              {hits.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-2 py-1.5"
                >
                  <span className="truncate font-medium text-charcoal">@{h.handle}</span>
                  <span className="shrink-0 font-mono text-[10px] text-charcoal-soft">
                    {h.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
