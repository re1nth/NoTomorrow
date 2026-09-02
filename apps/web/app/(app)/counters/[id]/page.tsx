'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type CounterRow, useCounters } from '@/components/CountersStore';
import { Button, Card } from '@/lib/ui';
import { beltFor, categoryFor, todayLocal } from '../belts';

const EMPTY_DAYS: Set<string> = new Set();

/**
 * Per-counter detail — vertically stacked year-strips, each in the same
 * 53-week × 7-day format as the /counters card heatmap. Topmost strip
 * ends on this week; each strip below tiles 53 weeks further into the
 * past. Always renders at least one full-year strip, and keeps stacking
 * until it reaches the counter's earliest signal.
 *
 * Reads the counter and its history from the shared store — no per-mount
 * fetch — so navigating in from /counters (or back out to Pomodoro and
 * returning) reuses the data already in memory.
 */
export default function CounterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { items, histories, loading, error } = useCounters();
  const counter = id ? (items.find((c) => c.id === id) ?? null) : null;
  const days = id ? (histories[id] ?? EMPTY_DAYS) : EMPTY_DAYS;

  if (loading && !counter) {
    return <p className="text-sm text-charcoal-soft">Loading…</p>;
  }
  if (!counter) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-glove-deep">{error ?? 'Counter not found.'}</p>
        <Link href="/counters" className="text-sm text-charcoal-soft underline">
          ← Back to counters
        </Link>
      </div>
    );
  }

  return <DetailBody counter={counter} days={days} />;
}

const WEEKS_PER_STRIP = 53;

function DetailBody({
  counter,
  days,
}: {
  counter: CounterRow;
  days: Set<string>;
}) {
  const { checkIn, error: storeError } = useCounters();
  const { current } = beltFor(counter.count);
  const today = todayLocal();
  const strips = useMemo(
    () => buildStrips(days, counter.createdAt, today),
    [days, counter.createdAt, today],
  );

  // Backfill via direct manipulation: click an empty past cell to arm it,
  // click Confirm to POST. State lives here so only one cell across all
  // strips can be armed at a time.
  const [armed, setArmed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flashDay, setFlashDay] = useState<string | null>(null);

  async function confirm() {
    if (!armed || submitting) return;
    setSubmitting(true);
    try {
      const day = armed;
      const row = await checkIn(counter.id, day);
      if (!row) return;
      setFlashDay(day);
      setTimeout(() => setFlashDay((v) => (v === day ? null : v)), 900);
      setArmed(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href={`/counters?category=${categoryFor(current)}`}
        className="text-xs uppercase tracking-wider text-charcoal-soft hover:text-charcoal transition-colors"
      >
        ← All counters
      </Link>

      <header className="mt-3 mb-2 flex items-start justify-between gap-6">
        <div>
          <EditableName counter={counter} />
          <div className="flex items-center gap-3 mt-2">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-display"
              style={{ backgroundColor: current.hex, color: current.ink }}
            >
              <span aria-hidden>●</span> {current.name} belt
            </span>
            <span className="text-xs text-charcoal-soft">
              {counter.count} {counter.count === 1 ? 'day' : 'days'} total
            </span>
          </div>
        </div>
        {/* Current-belt Ippo — bigger on the detail page so the ripped sprite
        is legible at 1:1-ish scale. Decorative only. */}
        <img
          aria-hidden
          src={current.sticker}
          alt=""
          draggable={false}
          className="pointer-events-none select-none shrink-0"
          style={{
            height: 152,
            width: 'auto',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
          }}
        />
      </header>

      <p className="text-xs text-charcoal-soft mb-8">
        Missed a day? Tap an empty square on the grid to backfill it.
      </p>

      {storeError ? <p className="mb-4 text-sm text-glove-deep">{storeError}</p> : null}

      <div className="space-y-10">
        {strips.map((s) => (
          <StripBlock
            key={s.key}
            strip={s}
            fillHex={current.hex}
            today={today}
            armed={armed}
            submitting={submitting}
            flashDay={flashDay}
            onArm={setArmed}
            onConfirm={confirm}
            onCancel={() => setArmed(null)}
          />
        ))}
      </div>

      <DangerZone counter={counter} />
    </div>
  );
}

function EditableName({ counter }: { counter: CounterRow }) {
  const { renameCounter } = useCounters();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(counter.name);
  const [saving, setSaving] = useState(false);

  function beginEdit() {
    setDraft(counter.name);
    setEditing(true);
  }

  async function save() {
    const next = draft.trim();
    if (!next || next === counter.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const row = await renameCounter(counter.id, next);
      // On failure the store surfaces the error above the strip block —
      // keep the input open so the user can retry or Escape.
      if (row) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={beginEdit}
        title="Click to rename"
        className="group inline-flex items-baseline gap-2 text-left"
      >
        <h1 className="font-display text-4xl tracking-wider">{counter.name}</h1>
        <span className="text-xs uppercase tracking-wider text-charcoal-soft opacity-0 group-hover:opacity-100 transition-opacity">
          Rename
        </span>
      </button>
    );
  }

  return (
    <div>
      <input
        autoFocus
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={() => void save()}
        disabled={saving}
        className="font-display text-4xl tracking-wider bg-transparent border-b border-charcoal/30 focus:border-charcoal focus:outline-none w-full max-w-xl"
      />
    </div>
  );
}

/**
 * Delete a counter — intentionally isolated at the bottom of the detail
 * page and gated behind typing the thread's name so a stray click can't
 * wipe a streak. Match is case-insensitive.
 */
function DangerZone({ counter }: { counter: CounterRow }) {
  const router = useRouter();
  const { deleteCounter, error: storeError } = useCounters();
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const armed = typed.trim().toLowerCase() === counter.name.trim().toLowerCase();

  async function del() {
    setPending(true);
    try {
      const ok = await deleteCounter(counter.id);
      if (ok) {
        // Land on the tab the deleted counter belonged to, not the
        // Warmup default — same pattern the "back" link at the top
        // of the page uses for its href.
        const category = categoryFor(beltFor(counter.count).current);
        router.push(`/counters?category=${category}`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-16">
      <Card
        tone="glove"
        className="border border-glove-deep/60 bg-canvas-soft"
      >
        <h2 className="font-display uppercase tracking-[0.2em] text-sm text-glove-deep mb-1">
          Danger zone
        </h2>
        <p className="text-sm text-charcoal-soft mb-4">
          Deleting <span className="text-charcoal">{counter.name}</span> wipes
          every check-in and the entire heatmap. This can't be undone.
        </p>
        <label className="block text-sm mb-3">
          <span className="block mb-1 uppercase tracking-wider text-xs text-charcoal-soft">
            Type <span className="text-charcoal">{counter.name}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={counter.name}
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-glove border border-charcoal/20 bg-canvas px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove"
          />
        </label>
        {storeError ? <p className="text-sm text-glove-deep mb-3">{storeError}</p> : null}
        <Button
          variant="primary"
          size="lg"
          disabled={!armed || pending}
          onClick={del}
        >
          {pending ? 'Deleting…' : 'Delete this thread'}
        </Button>
      </Card>
    </section>
  );
}

interface Cell {
  iso: string;
  filled: boolean;
  inFuture: boolean;
  monthIdx: number; // JS getMonth() 0..11 — used only for column-run month labels
  dayOfMonth: number;
}

interface Strip {
  key: string;
  /** Human range across the strip, e.g. "Jul 2025 → Jul 2026". */
  label: string;
  /** 53 columns × 7 rows, column-major, so rightmost column contains anchor. */
  columns: Cell[][];
  /** Column-position → month label, emitted only at first-Sunday-of-month. */
  monthLabels: { col: number; label: string }[];
}

/**
 * Tiled strips: strip 0 rightmost col = today's week; strip 1 rightmost col
 * = the Sunday one week before strip 0's leftmost; etc. We stop when the
 * next strip would be entirely before the counter's earliest anchor
 * (creation date and earliest signal), keeping at least one strip.
 */
function buildStrips(
  days: Set<string>,
  createdAt: string,
  today: string,
): Strip[] {
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const anchor = new Date(ty, tm - 1, td);
  const todayDow = anchor.getDay(); // 0..6, Sun..Sat
  const thisSunday = new Date(anchor);
  thisSunday.setDate(anchor.getDate() - todayDow);

  // Earliest anchor = min(createdAt, first check-in). Guards short/new counters.
  const createdDt = new Date(createdAt);
  let earliest = createdDt;
  for (const iso of days) {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const dt = new Date(y, m - 1, d);
    if (dt.getTime() < earliest.getTime()) earliest = dt;
  }

  const strips: Strip[] = [];
  let idx = 0;
  let stripEndSunday = new Date(thisSunday);
  while (true) {
    const stripStart = new Date(stripEndSunday);
    stripStart.setDate(stripEndSunday.getDate() - (WEEKS_PER_STRIP - 1) * 7);
    strips.push(buildStrip(idx, stripStart, anchor, days));
    // Stop once we've covered the earliest signal — but always render >=1 strip.
    if (stripStart.getTime() <= earliest.getTime()) break;
    stripEndSunday = new Date(stripStart);
    stripEndSunday.setDate(stripStart.getDate() - 7);
    idx += 1;
    // Safety guard against infinite loops from bad data.
    if (idx > 40) break;
  }
  return strips;
}

function buildStrip(
  idx: number,
  start: Date,
  anchor: Date,
  days: Set<string>,
): Strip {
  const columns: Cell[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let labeledMonth = -1;
  for (let w = 0; w < WEEKS_PER_STRIP; w++) {
    const col: Cell[] = [];
    for (let r = 0; r < 7; r++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + r);
      const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
      col.push({
        iso,
        filled: days.has(iso),
        inFuture: cell.getTime() > anchor.getTime(),
        monthIdx: cell.getMonth(),
        dayOfMonth: cell.getDate(),
      });
      // Month labels: only at the first Sunday of the month (day 1..7),
      // which prevents overlapping "Jun"/"Jul" at grid edges.
      if (
        r === 0 &&
        cell.getDate() <= 7 &&
        cell.getMonth() !== labeledMonth
      ) {
        monthLabels.push({
          col: w,
          label: cell.toLocaleString('en-US', { month: 'short' }),
        });
        labeledMonth = cell.getMonth();
      }
    }
    columns.push(col);
  }
  const first = columns[0]![0]!;
  const last = columns[WEEKS_PER_STRIP - 1]![6]!;
  const [fy, fm] = first.iso.split('-').map(Number) as [number, number];
  const [ly, lm] = last.iso.split('-').map(Number) as [number, number];
  const fmt = (y: number, m: number) =>
    new Date(y, m - 1, 1).toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  return {
    key: `strip-${idx}-${first.iso}`,
    label: `${fmt(fy, fm)} → ${fmt(ly, lm)}`,
    columns,
    monthLabels,
  };
}

function StripBlock({
  strip,
  fillHex,
  today,
  armed,
  submitting,
  flashDay,
  onArm,
  onConfirm,
  onCancel,
}: {
  strip: Strip;
  fillHex: string;
  today: string;
  armed: string | null;
  submitting: boolean;
  flashDay: string | null;
  onArm: (day: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [hover, setHover] = useState<{ iso: string; filled: boolean; inFuture: boolean } | null>(
    null,
  );
  // Armed cell is a strip-local concern only if this strip contains it —
  // the confirm prompt is contextual to the row you clicked.
  const armedHere = armed !== null && strip.columns.some((col) => col.some((c) => c.iso === armed));

  // Anchor the strip's horizontal scroll on its rightmost (most recent)
  // column on mount so the user lands on the latest activity in this
  // strip's range instead of the oldest.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2 min-h-[18px]">
        <span className="font-display uppercase tracking-[0.2em] text-xs text-charcoal-soft">
          {strip.label}
        </span>
        {armedHere && armed ? (
          <span className="flex items-center gap-2 text-[11px] text-charcoal">
            <span className="tabular-nums">Backfill {armed}?</span>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-glove text-white hover:bg-glove-deep transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full text-charcoal-soft hover:text-charcoal transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </span>
        ) : (
          <span className="text-[10px] text-charcoal-soft tabular-nums h-4">
            {hover
              ? hover.inFuture
                ? `${hover.iso} · —`
                : `${hover.iso}${hover.filled ? ' · checked in' : ''}`
              : ''}
          </span>
        )}
      </div>
      {/* Fixed cell + gap so cells stay readable at ~13px on any
          viewport; the wrapper scrolls horizontally when narrower than
          the grid, keeping the "specific counter horizontally scrollable"
          contract on mobile. */}
      <div ref={scrollRef} className="overflow-x-auto -mx-1 px-1">
        <div style={{ width: WEEKS_PER_STRIP * 13 + (WEEKS_PER_STRIP - 1) * 3 }}>
          {/* Month label row — same trick as the card mini-heatmap. */}
          <div
            className="relative text-[10px] uppercase tracking-wider text-charcoal-soft mb-1"
            style={{ height: 14 }}
          >
            {strip.monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute"
                style={{ left: m.col * (13 + 3) }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${WEEKS_PER_STRIP}, 13px)`,
              gridTemplateRows: 'repeat(7, 13px)',
              gridAutoFlow: 'column',
            }}
            onMouseLeave={() => setHover(null)}
          >
        {strip.columns.flatMap((col) =>
          col.map((c) => {
            const isHovered = hover?.iso === c.iso;
            const isArmed = armed === c.iso;
            const isFlashing = flashDay === c.iso;
            const backfillable = !c.filled && !c.inFuture;
            const outline = isArmed
              ? '1.5px solid #E63946'
              : isHovered
                ? backfillable
                  ? '1px solid rgba(230, 57, 70, 0.7)'
                  : '1px solid rgba(234, 228, 214, 0.9)'
                : c.iso === today
                  ? '1px solid rgba(234, 228, 214, 0.65)'
                  : 'none';
            const bg = c.inFuture
              ? 'transparent'
              : c.filled
                ? fillHex
                : isHovered && backfillable
                  ? 'rgba(230, 57, 70, 0.18)'
                  : 'rgba(234, 228, 214, 0.08)';
            const commonStyle = {
              backgroundColor: bg,
              outline,
              outlineOffset: outline === 'none' ? 0 : 1,
            } as const;
            const handleEnter = () =>
              setHover({ iso: c.iso, filled: c.filled, inFuture: c.inFuture });
            if (backfillable) {
              return (
                <button
                  key={c.iso}
                  type="button"
                  aria-label={
                    isArmed ? `Confirm backfill for ${c.iso}` : `Backfill ${c.iso}`
                  }
                  title={c.iso}
                  disabled={submitting && !isArmed}
                  onMouseEnter={handleEnter}
                  onClick={() => (isArmed ? onConfirm() : onArm(c.iso))}
                  className={`aspect-square rounded-[2px] p-0 border-0 cursor-pointer transition-transform hover:scale-110 ${
                    isFlashing ? 'animate-pulse' : ''
                  }`}
                  style={commonStyle}
                />
              );
            }
            return (
              <div
                key={c.iso}
                title={`${c.iso}${c.filled ? ' — checked in' : ''}`}
                className={`aspect-square rounded-[2px] ${isFlashing ? 'animate-pulse' : ''}`}
                onMouseEnter={handleEnter}
                style={commonStyle}
              />
            );
          }),
        )}
          </div>
        </div>
      </div>
    </section>
  );
}
