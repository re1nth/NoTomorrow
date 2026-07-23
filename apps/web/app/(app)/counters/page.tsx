'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@/lib/ui';
import { beltFor, CATEGORIES, type Category, categoryFor, todayLocal } from './belts';

interface CounterRow {
  id: string;
  name: string;
  count: number;
  lastCheckIn: string | null;
  createdAt: string;
}

export default function CountersPage() {
  const [items, setItems] = useState<CounterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', initialCount: 0 });
  const [pulsing, setPulsing] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('Warmup');
  // `today` in state so a mount that survives midnight (or a laptop resume
  // from sleep) still re-enables "+1 today" without a page reload.
  const [today, setToday] = useState(todayLocal);

  useEffect(() => {
    void refresh();
  }, []);

  // Fire once at the next local midnight, then reschedule daily. Also
  // re-checks on tab focus / visibility resume so a wake-from-sleep
  // catches up even if the timer was throttled.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function schedule() {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5, // 5s past midnight so any TZ rounding lands on the new day
      );
      const ms = Math.max(1000, nextMidnight.getTime() - now.getTime());
      timer = setTimeout(() => {
        setToday(todayLocal());
        void refresh();
        schedule();
      }, ms);
    }
    function catchUp() {
      const now = todayLocal();
      setToday((prev) => {
        if (prev !== now) void refresh();
        return now;
      });
    }
    schedule();
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('focus', catchUp);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('focus', catchUp);
    };
  }, []);

  async function refresh() {
    setError(null);
    try {
      const res = await fetch('/api/counters', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const json = (await res.json()) as { counters: CounterRow[] };
      setItems(json.counters);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addCounter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const name = draft.name.trim();
    if (!name) return;
    const res = await fetch('/api/counters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, initialCount: draft.initialCount }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Create failed: ${res.status}`);
      return;
    }
    const row = (await res.json()) as CounterRow;
    setItems((cs) => [...cs, row]);
    setDraft({ name: '', initialCount: 0 });
    setAdding(false);
  }

  async function checkIn(id: string): Promise<boolean> {
    setError(null);
    const res = await fetch(`/api/counters/${id}/checkin`, { method: 'POST' });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string; counter?: CounterRow }
        | null;
      setError(body?.error ?? `Check-in failed: ${res.status}`);
      if (body?.counter) {
        setItems((cs) => cs.map((c) => (c.id === id ? body.counter! : c)));
      }
      return false;
    }
    const row = (await res.json()) as CounterRow;
    setItems((cs) => cs.map((c) => (c.id === id ? row : c)));
    setPulsing(id);
    setTimeout(() => setPulsing((p) => (p === id ? null : p)), 900);
    return true;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl tracking-wider">Counters</h1>
          <p className="text-sm text-charcoal-soft mt-1">
            One thread, one punch a day. Don't break the chain.
          </p>
        </div>
        <Button onClick={() => setAdding((v) => !v)} variant={adding ? 'ghost' : 'primary'}>
          {adding ? 'Cancel' : '+ New thread'}
        </Button>
      </header>

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.div
            key="add-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="overflow-hidden mb-6"
          >
            <Card tone="glove">
              <form onSubmit={addCounter} className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
                <label className="block text-sm">
                  <span className="block mb-1 uppercase tracking-wider text-xs">Thread name</span>
                  <input
                    autoFocus
                    required
                    maxLength={80}
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Gym, Badminton, Builder…"
                    className="w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block mb-1 uppercase tracking-wider text-xs">Starting count</span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={draft.initialCount}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, initialCount: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className="w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove"
                  />
                </label>
                <Button type="submit" variant="primary" size="lg">
                  Create
                </Button>
              </form>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-glove-deep mb-4"
        >
          {error}
        </motion.p>
      ) : null}

      {loading ? (
        <p className="text-sm text-charcoal-soft">Loading…</p>
      ) : items.length === 0 ? (
        <Card tone="default" className="text-center py-12">
          <p className="font-display text-2xl mb-2">No threads yet.</p>
          <p className="text-sm text-charcoal-soft">
            Add one — gym, badminton, builder — and start your streak.
          </p>
        </Card>
      ) : (
        <>
          <CategoryTabs items={items} active={category} onSelect={setCategory} />
          <div className="grid grid-cols-1 gap-5 max-w-[896px] mx-auto">
            <AnimatePresence initial={false}>
              {items
                .filter((c) => categoryFor(beltFor(c.count).current) === category)
                .sort((a, b) => b.count - a.count)
                .map((c) => (
                  <CounterCard
                    key={c.id}
                    counter={c}
                    pulsing={pulsing === c.id}
                    today={today}
                    onCheckIn={() => checkIn(c.id)}
                  />
                ))}
            </AnimatePresence>
            {items.every((c) => categoryFor(beltFor(c.count).current) !== category) ? (
              <Card tone="default" className="text-center py-10">
                <p className="font-display text-xl mb-1">Nothing at {category} yet.</p>
                <p className="text-sm text-charcoal-soft">
                  Threads land here as they progress through belts.
                </p>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryTabs({
  items,
  active,
  onSelect,
}: {
  items: CounterRow[];
  active: Category;
  onSelect: (c: Category) => void;
}) {
  const counts = useMemo(() => {
    const acc: Record<Category, number> = { Warmup: 0, Hanging: 0, Barrage: 0 };
    for (const it of items) acc[categoryFor(beltFor(it.count).current)] += 1;
    return acc;
  }, [items]);

  return (
    <div className="mb-6 flex justify-center">
      <div className="inline-flex items-center rounded-full bg-canvas-soft border border-charcoal/15 p-1 shadow-sm">
        {CATEGORIES.map((cat) => {
          const isActive = cat.name === active;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onSelect(cat.name)}
              className="relative px-5 py-2 rounded-full text-xs font-display tracking-wider uppercase transition-colors"
              style={{ color: isActive ? cat.ink : undefined }}
            >
              {isActive ? (
                <motion.span
                  layoutId="category-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundImage: `linear-gradient(100deg, ${cat.from}, ${cat.to})`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-2">
                {cat.name}
                <span className="tabular-nums opacity-70">{counts[cat.name]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CounterCard({
  counter,
  pulsing,
  today,
  onCheckIn,
}: {
  counter: CounterRow;
  pulsing: boolean;
  today: string;
  onCheckIn: () => Promise<boolean>;
}) {
  const { current, next, progress } = beltFor(counter.count);
  const checkedToday = counter.lastCheckIn === today;
  const pct = Math.round(progress * 100);

  const [history, setHistory] = useState<Set<string>>(() => new Set());
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/counters/${counter.id}/history`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { days: string[] };
      setHistory(new Set(json.days));
    } catch {
      // Heatmap is non-critical; swallow and keep the card usable.
    }
  }, [counter.id]);
  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  async function handleCheckIn() {
    const ok = await onCheckIn();
    if (ok) {
      setHistory((prev) => {
        const next = new Set(prev);
        next.add(today);
        return next;
      });
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative"
    >
      <Card tone="default" className="relative overflow-hidden">
        {/* Belt-color halo behind the number — pulses on check-in. */}
        <motion.div
          aria-hidden
          className="absolute -top-12 -right-12 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: current.hex }}
          animate={pulsing ? { opacity: [0.3, 0.85, 0.3], scale: [1, 1.25, 1] } : { opacity: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Ippo sticker for the current belt — sits in the top-right corner
        over the halo, pulses along with the check-in flash. Decorative only. */}
        <motion.img
          aria-hidden
          src={current.sticker}
          alt=""
          draggable={false}
          className="absolute right-4 top-4 pointer-events-none select-none"
          style={{
            height: 108,
            width: 'auto',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.28))',
          }}
          initial={false}
          animate={
            pulsing
              ? { scale: [1, 1.14, 1], rotate: [0, -3, 3, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        <div className="flex items-start justify-between gap-3 pr-24">
          <div>
            <div className="font-display text-2xl tracking-wider">{counter.name}</div>
            <div className="flex items-center gap-3 flex-wrap">
              <BeltBadge belt={current} />
              <Link
                href={`/counters/${counter.id}`}
                className="text-[11px] uppercase tracking-wider text-charcoal-soft hover:text-charcoal transition-colors"
              >
                History →
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div className="leading-none">
            <span className="uppercase tracking-wider text-xs text-charcoal-soft block mb-1">
              Days
            </span>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={counter.count}
                initial={{ y: 14, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -14, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                className="font-display text-6xl tabular-nums"
              >
                {counter.count}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="text-right text-xs text-charcoal-soft pb-2">
            {next ? (
              <>
                <div>
                  Next belt:{' '}
                  <span className="font-display tracking-wider text-charcoal">{next.name}</span>
                </div>
                <div>at {next.threshold} days</div>
              </>
            ) : (
              <div className="font-display tracking-wider">Top tier reached.</div>
            )}
          </div>
        </div>

        {/* Progress bar. Belt color fills, with a thin track underneath. */}
        <div className="mt-3 h-2.5 rounded-full bg-charcoal/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: current.hex }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-charcoal-soft mt-1">
          <span>
            {current.name} · {current.threshold}
          </span>
          <span>{next ? `${next.threshold - counter.count} to go` : '∞'}</span>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs text-charcoal-soft">
            {counter.lastCheckIn ? (
              <>Last: <span className="text-charcoal">{counter.lastCheckIn}</span></>
            ) : (
              <>No check-in yet.</>
            )}
          </div>
          <motion.div whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.04 }}>
            <Button
              onClick={handleCheckIn}
              variant={checkedToday ? 'ghost' : 'primary'}
              size="lg"
              disabled={checkedToday}
            >
              {checkedToday ? '✓ Done today' : '+1 today'}
            </Button>
          </motion.div>
        </div>

        <Heatmap days={history} today={today} fillHex={current.hex} />
      </Card>
    </motion.div>
  );
}

/**
 * GitHub-style contribution grid — 53 weeks × 7 days, ending on this week.
 * Filled cells use the counter's current belt color so each thread "looks
 * like" its tier at a glance. Cells overflow-scroll on narrow cards.
 */
function Heatmap({
  days,
  today,
  fillHex,
}: {
  days: Set<string>;
  today: string;
  fillHex: string;
}) {
  const WEEKS = 53;
  const [hover, setHover] = useState<{ day: string; filled: boolean; inFuture: boolean } | null>(
    null,
  );
  const { columns, monthLabels } = useMemo(() => {
    // Anchor on today, parsed as local date (avoid TZ drift from `new Date(today)`).
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const anchor = new Date(y, m - 1, d);
    // Walk back to the most recent Sunday so the rightmost column is "this week".
    const todayDow = anchor.getDay(); // 0..6, Sun..Sat
    const lastSunday = new Date(anchor);
    lastSunday.setDate(anchor.getDate() - todayDow);
    // Start of the grid = lastSunday minus (WEEKS - 1) weeks.
    const start = new Date(lastSunday);
    start.setDate(lastSunday.getDate() - (WEEKS - 1) * 7);

    const cols: { day: string; inFuture: boolean }[][] = [];
    const labels: { col: number; label: string }[] = [];
    let labeledMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const col: { day: string; inFuture: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const cell = new Date(start);
        cell.setDate(start.getDate() + w * 7 + r);
        const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(
          cell.getDate(),
        ).padStart(2, '0')}`;
        const inFuture = cell.getTime() > anchor.getTime();
        col.push({ day: iso, inFuture });
        // Label a month only at its first full Sunday (date 1..7). This skips
        // partial months at the grid edges so we never get two labels in
        // adjacent columns (the cause of "Jun"/"Jul" overlap when the grid
        // starts on the last Sunday of a month).
        if (
          r === 0 &&
          cell.getDate() <= 7 &&
          cell.getMonth() !== labeledMonth
        ) {
          labels.push({
            col: w,
            label: cell.toLocaleString('en-US', { month: 'short' }),
          });
          labeledMonth = cell.getMonth();
        }
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels: labels };
  }, [today]);

  const CELL = 13;
  const GAP = 3;

  return (
    <div className="mt-5 border-t border-charcoal/10 pt-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="uppercase tracking-wider text-[10px] text-charcoal-soft">
          Last year
        </span>
        <span className="text-[10px] text-charcoal-soft tabular-nums">
          {hover
            ? hover.inFuture
              ? `${hover.day} · —`
              : `${hover.day}${hover.filled ? ' · checked in' : ''}`
            : `${days.size} ${days.size === 1 ? 'day' : 'days'}`}
        </span>
      </div>
      <div>
        <div className="inline-block" onMouseLeave={() => setHover(null)}>
          {/* Month labels — positioned along the top row of cells. */}
          <div
            className="relative text-[9px] uppercase tracking-wider text-charcoal-soft"
            style={{ height: 12, width: WEEKS * (CELL + GAP) }}
          >
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute"
                style={{ left: m.col * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`,
              columnGap: GAP,
              rowGap: GAP,
              gridAutoFlow: 'column',
              gridTemplateRows: `repeat(7, ${CELL}px)`,
            }}
          >
            {columns.flatMap((col) =>
              col.map((cell) => {
                const filled = days.has(cell.day);
                const isToday = cell.day === today;
                const isHovered = hover?.day === cell.day;
                const outline = isHovered
                  ? '1px solid rgba(234, 228, 214, 0.85)'
                  : isToday
                    ? '1px solid rgba(234, 228, 214, 0.55)'
                    : 'none';
                return (
                  <div
                    key={cell.day}
                    title={`${cell.day}${filled ? ' — checked in' : ''}`}
                    className="rounded-[2px]"
                    onMouseEnter={() => setHover({ day: cell.day, filled, inFuture: cell.inFuture })}
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: cell.inFuture
                        ? 'transparent'
                        : filled
                          ? fillHex
                          : 'rgba(234, 228, 214, 0.10)',
                      outline,
                      outlineOffset: outline === 'none' ? 0 : 1,
                      opacity: cell.inFuture ? 0 : 1,
                    }}
                  />
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BeltBadge({ belt }: { belt: { name: string; hex: string; ink: string } }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-display"
      style={{ backgroundColor: belt.hex, color: belt.ink }}
    >
      <span aria-hidden>●</span> {belt.name} belt
    </span>
  );
}
