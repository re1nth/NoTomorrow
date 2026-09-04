'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EasterEgg } from '@/components/EasterEgg';
import { useEasterAccess } from '@/components/EasterAccessProvider';
import { SectionTitle } from '@/components/SectionTitle';
import { type CounterRow, useCounters } from '@/components/CountersStore';
import { Button, Card } from '@/lib/ui';
import { beltFor, CATEGORIES, type Category, categoryFor } from './belts';

// Stable empty set so cards without a loaded history don't churn Heatmap memo.
const EMPTY_HISTORY: Set<string> = new Set();

type View = 'expanded' | 'compact';
const VIEW_STORAGE_KEY = 'counters:view';

export default function CountersPage() {
  const {
    items,
    histories,
    loading,
    error,
    today,
    addCounter,
    checkIn,
  } = useCounters();
  const [adding, setAdding] = useState(false);
  // initialCount is a string so an empty field is representable — a number
  // typed as 0 by default would mean deleting the "0" fires an onChange
  // that parses back to 0 and re-fills the input, blocking edit.
  const [draft, setDraft] = useState<{ name: string; initialCount: string }>({
    name: '',
    initialCount: '',
  });

  const [pulsing, setPulsing] = useState<string | null>(null);
  // View mode persists across reloads. Start expanded to avoid a hydration
  // mismatch, then read localStorage on mount and adopt the stored value.
  const [view, setView] = useState<View>('expanded');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'compact' || stored === 'expanded') setView(stored);
    } catch {
      // localStorage blocked (private mode, etc.) — leave default.
    }
  }, []);
  const toggleView = useCallback(() => {
    setView((v) => {
      const next: View = v === 'compact' ? 'expanded' : 'compact';
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, next);
      } catch {
        // Non-fatal — user gets a session-only toggle.
      }
      return next;
    });
  }, []);
  // Category lives in the URL so returning from a counter detail page lands
  // on the belt-appropriate tab; local state alone would be preserved across
  // App Router soft navigations and ignore the ?category= hint.
  const router = useRouter();
  const searchParams = useSearchParams();
  const easterEnabled = useEasterAccess();
  const rawCategory = searchParams?.get('category');
  const category: Category =
    rawCategory === 'Hanging' || rawCategory === 'Barrage' || rawCategory === 'Warmup'
      ? rawCategory
      : 'Warmup';
  const setCategory = useCallback(
    (c: Category) => {
      const p = new URLSearchParams(searchParams?.toString() ?? '');
      p.set('category', c);
      router.replace(`/counters?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  async function onSubmitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const parsed = Number.parseInt(draft.initialCount, 10);
    const initialCount = Number.isFinite(parsed) ? Math.max(0, Math.min(100000, parsed)) : 0;
    const row = await addCounter({ name, initialCount });
    if (!row) return;
    setDraft({ name: '', initialCount: '' });
    setAdding(false);
    // Jump to the tab the new thread belongs in so it lands visible even
    // when the user was viewing a different category (e.g. creating a
    // Barrage thread with an initial count of 200 while sitting on Warmup).
    setCategory(categoryFor(beltFor(row.count).current));
  }

  async function handleCheckIn(id: string): Promise<boolean> {
    const row = await checkIn(id);
    if (!row) return false;
    setPulsing(id);
    setTimeout(() => setPulsing((p) => (p === id ? null : p)), 900);
    return true;
  }

  return (
    <>
      {easterEnabled ? <EasterEgg /> : null}
      <SectionTitle
        title="Counters"
        subtitle="One thread, one punch a day. Don't break the chain."
        right={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onToggle={toggleView} />
            <Button onClick={() => setAdding((v) => !v)} variant={adding ? 'ghost' : 'primary'}>
              {adding ? 'Cancel' : '+ New thread'}
            </Button>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto">
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
              {/* Single column on mobile so the two inputs + Create don't
                  cram into a phone-width row; sm:+ restores the original
                  3-col grid layout. */}
              <form
                onSubmit={onSubmitAdd}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
              >
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
                    inputMode="numeric"
                    min={0}
                    max={100000}
                    value={draft.initialCount}
                    onChange={(e) => setDraft((d) => ({ ...d, initialCount: e.target.value }))}
                    placeholder="0"
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
      ) : (
        <>
          <CategoryTabs items={items} active={category} onSelect={setCategory} />
          {items.length === 0 ? (
            <Card tone="default" className="text-center py-12">
              <p className="font-display text-2xl mb-2">No threads yet.</p>
              <p className="text-sm text-charcoal-soft">
                Add one — gym, badminton, builder — and start your streak.
              </p>
            </Card>
          ) : (
            <div
              key={`${view}:${category}`}
              className={
                view === 'compact'
                  ? 'grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]'
                  : 'grid grid-cols-1 gap-5 max-w-[896px] mx-auto'
              }
            >
              {/*
                Grid is keyed by view+category so switching tabs (or toggling
                compact/expanded) unmounts the previous list entirely and the
                new one mounts fresh. Without the key, motion.div's `layout`
                prop on cards would preserve their prior cell positions across
                the tab change and the entering cards would land in cells
                where the leaving cards used to sit — leaving huge gaps for
                any tab with fewer cards than the last.
              */}
              <AnimatePresence initial={false} mode="popLayout">
                {items
                  .filter((c) => categoryFor(beltFor(c.count).current) === category)
                  .sort((a, b) => b.count - a.count)
                  .map((c) =>
                    view === 'compact' ? (
                      <CompactCounterCard
                        key={c.id}
                        counter={c}
                        history={histories[c.id]}
                        pulsing={pulsing === c.id}
                        today={today}
                        onCheckIn={() => handleCheckIn(c.id)}
                      />
                    ) : (
                      <CounterCard
                        key={c.id}
                        counter={c}
                        history={histories[c.id]}
                        pulsing={pulsing === c.id}
                        today={today}
                        onCheckIn={() => handleCheckIn(c.id)}
                      />
                    ),
                  )}
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
          )}
        </>
      )}
      </div>
    </>
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
  history,
  pulsing,
  today,
  onCheckIn,
}: {
  counter: CounterRow;
  history: Set<string> | undefined;
  pulsing: boolean;
  today: string;
  onCheckIn: () => Promise<boolean>;
}) {
  const { current, next, progress } = beltFor(counter.count);
  const checkedToday = counter.lastCheckIn === today;
  const pct = Math.round(progress * 100);
  const days = history ?? EMPTY_HISTORY;

  async function handleCheckIn() {
    await onCheckIn();
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

        <Heatmap days={days} today={today} fillHex={current.hex} />
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

  // Anchor the scroll to "this week" (rightmost column) on mount so the
  // user lands on their most recent check-ins instead of a year-old
  // Sunday. Re-runs on `today` change (e.g. midnight rollover) to keep
  // the anchor on the current week.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [today]);

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
      <div ref={scrollRef} className="overflow-x-auto -mx-1 px-1">
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

function ViewToggle({ view, onToggle }: { view: View; onToggle: () => void }) {
  const isCompact = view === 'compact';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isCompact ? 'Switch to expanded view' : 'Switch to compact view'}
      aria-label={isCompact ? 'Switch to expanded view' : 'Switch to compact view'}
      aria-pressed={isCompact}
      className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-charcoal/20 bg-canvas-soft text-charcoal-soft hover:text-charcoal hover:border-charcoal/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glove"
    >
      {isCompact ? (
        // "Rows" icon → clicking returns to expanded stacked view.
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img">
          <title>Rows</title>
          <rect x="2" y="3" width="12" height="3" rx="1" fill="currentColor" />
          <rect x="2" y="10" width="12" height="3" rx="1" fill="currentColor" />
        </svg>
      ) : (
        // "Grid" icon → clicking condenses to compact grid.
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img">
          <title>Grid</title>
          <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

function CompactCounterCard({
  counter,
  history,
  pulsing,
  today,
  onCheckIn,
}: {
  counter: CounterRow;
  history: Set<string> | undefined;
  pulsing: boolean;
  today: string;
  onCheckIn: () => Promise<boolean>;
}) {
  const { current, next, progress } = beltFor(counter.count);
  const checkedToday = counter.lastCheckIn === today;
  const pct = Math.round(progress * 100);
  const days = history ?? EMPTY_HISTORY;

  async function handleCheckIn() {
    await onCheckIn();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative"
    >
      <Card tone="default" className="relative overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ backgroundColor: current.hex }}
          animate={pulsing ? { opacity: [0.3, 0.85, 0.3], scale: [1, 1.25, 1] } : { opacity: 0.3 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.img
          aria-hidden
          src={current.sticker}
          alt=""
          draggable={false}
          className="absolute right-2 top-2 pointer-events-none select-none"
          style={{
            height: 56,
            width: 'auto',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.28))',
          }}
          initial={false}
          animate={
            pulsing
              ? { scale: [1, 1.14, 1], rotate: [0, -3, 3, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        <div className="pr-14 min-w-0">
          <Link
            href={`/counters/${counter.id}`}
            className="font-display text-base tracking-wider truncate block hover:text-glove transition-colors"
          >
            {counter.name}
          </Link>
          <BeltBadge belt={current} />
        </div>

        <div className="mt-2 leading-none flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={counter.count}
                initial={{ y: 10, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -10, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                className="font-display text-4xl tabular-nums"
              >
                {counter.count}
              </motion.span>
            </AnimatePresence>
            <span className="uppercase tracking-wider text-[10px] text-charcoal-soft">
              days
            </span>
          </div>
          {/* Compact +1 pill — inline with the count row, saves a full
              button-row of vertical space vs. the block variant. */}
          <motion.button
            type="button"
            onClick={handleCheckIn}
            disabled={checkedToday}
            whileTap={checkedToday ? undefined : { scale: 0.92 }}
            whileHover={checkedToday ? undefined : { scale: 1.05 }}
            aria-label={checkedToday ? 'Already checked in today' : 'Check in for today'}
            title={checkedToday ? 'Done for today' : '+1 today'}
            className={
              checkedToday
                ? 'inline-flex items-center justify-center h-8 min-w-[52px] px-3 rounded-full text-[13px] font-display uppercase tracking-wider bg-transparent text-charcoal-soft border border-charcoal/20 cursor-not-allowed'
                : 'inline-flex items-center justify-center h-8 min-w-[52px] px-3.5 rounded-full text-[13px] font-display uppercase tracking-wider bg-glove text-canvas-soft shadow-glove hover:bg-glove-bright active:bg-glove-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glove focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-colors'
            }
          >
            {checkedToday ? '✓' : '+1'}
          </motion.button>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-charcoal/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: current.hex }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          />
        </div>
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-charcoal-soft mt-1">
          <span>{next ? `Next: ${next.name}` : 'Top tier'}</span>
          <span>{next ? `${next.threshold - counter.count} to go` : '∞'}</span>
        </div>

        <MiniHeatmap days={days} today={today} fillHex={current.hex} />
      </Card>
    </motion.div>
  );
}

/**
 * 5-week × 7-day mini heatmap — same anchoring as Heatmap but sized to fit
 * inside a compact card. No month labels, no hover state, tooltip-only.
 */
function MiniHeatmap({
  days,
  today,
  fillHex,
}: {
  days: Set<string>;
  today: string;
  fillHex: string;
}) {
  const WEEKS = 5;
  const columns = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const anchor = new Date(y, m - 1, d);
    const todayDow = anchor.getDay();
    const lastSunday = new Date(anchor);
    lastSunday.setDate(anchor.getDate() - todayDow);
    const start = new Date(lastSunday);
    start.setDate(lastSunday.getDate() - (WEEKS - 1) * 7);
    const cols: { day: string; inFuture: boolean }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: { day: string; inFuture: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const cell = new Date(start);
        cell.setDate(start.getDate() + w * 7 + r);
        const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
        col.push({ day: iso, inFuture: cell.getTime() > anchor.getTime() });
      }
      cols.push(col);
    }
    return cols;
  }, [today]);

  const CELL = 10;
  const GAP = 2;
  const filledCount = days.size;

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/10">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="uppercase tracking-wider text-[9px] text-charcoal-soft">
          Last 30 days
        </span>
        <span className="text-[9px] text-charcoal-soft tabular-nums">
          {filledCount} {filledCount === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div
        className="grid mx-auto"
        style={{
          gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`,
          columnGap: GAP,
          rowGap: GAP,
          gridAutoFlow: 'column',
          gridTemplateRows: `repeat(7, ${CELL}px)`,
          width: WEEKS * (CELL + GAP) - GAP,
        }}
      >
        {columns.flatMap((col) =>
          col.map((cell) => {
            const filled = days.has(cell.day);
            const isToday = cell.day === today;
            return (
              <div
                key={cell.day}
                title={
                  cell.inFuture ? cell.day : `${cell.day}${filled ? ' — checked in' : ''}`
                }
                className="rounded-[2px]"
                style={{
                  width: CELL,
                  height: CELL,
                  backgroundColor: cell.inFuture
                    ? 'transparent'
                    : filled
                      ? fillHex
                      : 'rgba(234, 228, 214, 0.10)',
                  outline: isToday ? '1px solid rgba(234, 228, 214, 0.55)' : 'none',
                  outlineOffset: 1,
                  opacity: cell.inFuture ? 0 : 1,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
