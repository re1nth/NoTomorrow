'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@/lib/ui';
import { beltFor, todayLocal } from '../belts';

interface CounterRow {
  id: string;
  name: string;
  count: number;
  lastCheckIn: string | null;
  createdAt: string;
}

/**
 * Per-counter detail — vertically stacked year-strips, each in the same
 * 53-week × 7-day format as the /counters card heatmap. Topmost strip
 * ends on this week; each strip below tiles 53 weeks further into the
 * past. Always renders at least one full-year strip, and keeps stacking
 * until it reaches the counter's earliest signal.
 */
export default function CounterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [counter, setCounter] = useState<CounterRow | null>(null);
  const [days, setDays] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const [cRes, hRes] = await Promise.all([
          fetch(`/api/counters/${id}`, { cache: 'no-store' }),
          fetch(`/api/counters/${id}/history`, { cache: 'no-store' }),
        ]);
        if (!cRes.ok) throw new Error(`Counter fetch failed: ${cRes.status}`);
        if (!hRes.ok) throw new Error(`History fetch failed: ${hRes.status}`);
        const cJson = (await cRes.json()) as CounterRow;
        const hJson = (await hRes.json()) as { days: string[] };
        if (cancelled) return;
        setCounter(cJson);
        setDays(new Set(hJson.days));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="text-sm text-charcoal-soft">Loading…</p>;
  }
  if (error || !counter) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-glove-deep">{error ?? 'Counter not found.'}</p>
        <Link href="/counters" className="text-sm text-charcoal-soft underline">
          ← Back to counters
        </Link>
      </div>
    );
  }

  return (
    <DetailBody
      counter={counter}
      days={days}
      onRenamed={(name) => setCounter((c) => (c ? { ...c, name } : c))}
    />
  );
}

const WEEKS_PER_STRIP = 53;

function DetailBody({
  counter,
  days,
  onRenamed,
}: {
  counter: CounterRow;
  days: Set<string>;
  onRenamed: (name: string) => void;
}) {
  const { current } = beltFor(counter.count);
  const today = todayLocal();
  const strips = useMemo(
    () => buildStrips(days, counter.createdAt, today),
    [days, counter.createdAt, today],
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/counters"
        className="text-xs uppercase tracking-wider text-charcoal-soft hover:text-charcoal transition-colors"
      >
        ← All counters
      </Link>

      <header className="mt-3 mb-8 flex items-start justify-between gap-6">
        <div>
          <EditableName counter={counter} onRenamed={onRenamed} />
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

      <div className="space-y-10">
        {strips.map((s) => (
          <StripBlock key={s.key} strip={s} fillHex={current.hex} today={today} />
        ))}
      </div>

      <DangerZone counter={counter} />
    </div>
  );
}

function EditableName({
  counter,
  onRenamed,
}: {
  counter: CounterRow;
  onRenamed: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(counter.name);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function beginEdit() {
    setDraft(counter.name);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const next = draft.trim();
    if (!next || next === counter.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/counters/${counter.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Rename failed: ${res.status}`);
      }
      onRenamed(next);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
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
          if (e.key === 'Escape') {
            setEditing(false);
            setErr(null);
          }
        }}
        onBlur={() => void save()}
        disabled={saving}
        className="font-display text-4xl tracking-wider bg-transparent border-b border-charcoal/30 focus:border-charcoal focus:outline-none w-full max-w-xl"
      />
      {err ? <p className="text-sm text-glove-deep mt-2">{err}</p> : null}
    </div>
  );
}

/**
 * Delete a counter — intentionally isolated at the bottom of the detail
 * page and gated behind typing the thread's exact name so a stray click
 * can't wipe a streak. Case-sensitive; the match must be one-for-one.
 */
function DangerZone({ counter }: { counter: CounterRow }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const armed = typed === counter.name;

  async function del() {
    setErr(null);
    setPending(true);
    try {
      const res = await fetch(`/api/counters/${counter.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setErr(`Delete failed: ${res.status}`);
        return;
      }
      router.push('/counters');
    } catch (e) {
      setErr((e as Error).message);
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
        {err ? <p className="text-sm text-glove-deep mb-3">{err}</p> : null}
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
}: {
  strip: Strip;
  fillHex: string;
  today: string;
}) {
  const [hover, setHover] = useState<{ iso: string; filled: boolean; inFuture: boolean } | null>(
    null,
  );
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display uppercase tracking-[0.2em] text-xs text-charcoal-soft">
          {strip.label}
        </span>
        <span className="text-[10px] text-charcoal-soft tabular-nums h-4">
          {hover
            ? hover.inFuture
              ? `${hover.iso} · —`
              : `${hover.iso}${hover.filled ? ' · checked in' : ''}`
            : ''}
        </span>
      </div>
      {/* Month label row — same trick as the card mini-heatmap. */}
      <div
        className="relative text-[10px] uppercase tracking-wider text-charcoal-soft mb-1"
        style={{ height: 14 }}
      >
        {strip.monthLabels.map((m) => (
          <span
            key={`${m.col}-${m.label}`}
            className="absolute"
            style={{
              left: `calc((100% + 3px) / ${WEEKS_PER_STRIP} * ${m.col})`,
            }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${WEEKS_PER_STRIP}, minmax(0, 1fr))`,
          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
          gridAutoFlow: 'column',
        }}
        onMouseLeave={() => setHover(null)}
      >
        {strip.columns.flatMap((col) =>
          col.map((c) => {
            const isHovered = hover?.iso === c.iso;
            const outline = isHovered
              ? '1px solid rgba(234, 228, 214, 0.9)'
              : c.iso === today
                ? '1px solid rgba(234, 228, 214, 0.65)'
                : 'none';
            return (
              <div
                key={c.iso}
                title={`${c.iso}${c.filled ? ' — checked in' : ''}`}
                className="aspect-square rounded-[2px]"
                onMouseEnter={() =>
                  setHover({ iso: c.iso, filled: c.filled, inFuture: c.inFuture })
                }
                style={{
                  backgroundColor: c.inFuture
                    ? 'transparent'
                    : c.filled
                      ? fillHex
                      : 'rgba(234, 228, 214, 0.08)',
                  outline,
                  outlineOffset: outline === 'none' ? 0 : 1,
                }}
              />
            );
          }),
        )}
      </div>
    </section>
  );
}
