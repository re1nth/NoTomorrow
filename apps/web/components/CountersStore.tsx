'use client';

import { todayLocal } from '@/app/(app)/counters/belts';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface CounterRow {
  id: string;
  name: string;
  count: number;
  lastCheckIn: string | null;
  createdAt: string;
}

type HistoryMap = Record<string, Set<string>>;

interface CountersStore {
  items: CounterRow[];
  histories: HistoryMap;
  loading: boolean;
  error: string | null;
  today: string;
  refresh: () => Promise<void>;
  addCounter: (input: {
    name: string;
    initialCount: number;
  }) => Promise<CounterRow | null>;
  checkIn: (id: string, day?: string) => Promise<CounterRow | null>;
  renameCounter: (id: string, name: string) => Promise<CounterRow | null>;
  deleteCounter: (id: string) => Promise<boolean>;
  clearError: () => void;
}

const CountersContext = createContext<CountersStore | null>(null);

export function useCounters(): CountersStore {
  const ctx = useContext(CountersContext);
  if (!ctx) throw new Error('useCounters must be used within CountersProvider');
  return ctx;
}

/**
 * Session-scoped store for the counters + per-counter check-in histories.
 *
 * Lives in the (app) shell so it survives soft navigation between /counters,
 * /pomodoro, and /settings — the list + histories are fetched once on mount
 * and then updated in-place from mutation responses. Revalidates only on
 * local-midnight rollover and on tab focus / visibility to catch wake-from-
 * sleep or check-ins from another tab.
 */
export function CountersProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CounterRow[]>([]);
  const [histories, setHistories] = useState<HistoryMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(todayLocal);

  // Deduplicate parallel history fetches for the same counter (e.g. list
  // page + detail page mounting simultaneously).
  const historyInFlight = useRef<Map<string, Promise<void>>>(new Map());

  const fetchHistory = useCallback(async (id: string): Promise<void> => {
    const existing = historyInFlight.current.get(id);
    if (existing) return existing;
    const p = (async () => {
      try {
        const res = await fetch(`/api/counters/${id}/history`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { days: string[] };
        setHistories((prev) => ({ ...prev, [id]: new Set(json.days) }));
      } catch {
        // Heatmap is non-critical; keep the card usable.
      } finally {
        historyInFlight.current.delete(id);
      }
    })();
    historyInFlight.current.set(id, p);
    return p;
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/counters', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const json = (await res.json()) as { counters: CounterRow[] };
      setItems(json.counters);
      await Promise.all(json.counters.map((c) => fetchHistory(c.id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
  }, [refresh]);

  const addCounter = useCallback(
    async ({ name, initialCount }: { name: string; initialCount: number }) => {
      setError(null);
      const res = await fetch('/api/counters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, initialCount }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Create failed: ${res.status}`);
        return null;
      }
      const row = (await res.json()) as CounterRow;
      setItems((cs) => [...cs, row]);
      setHistories((prev) => ({ ...prev, [row.id]: new Set<string>() }));
      return row;
    },
    [],
  );

  const checkIn = useCallback(
    async (id: string, day?: string): Promise<CounterRow | null> => {
      setError(null);
      const res = await fetch(`/api/counters/${id}/checkin`, {
        method: 'POST',
        headers: day ? { 'content-type': 'application/json' } : undefined,
        body: day ? JSON.stringify({ day }) : undefined,
      });
      const parsed = (await res.json().catch(() => null)) as
        | CounterRow
        | { error: string; counter?: CounterRow }
        | null;
      if (!res.ok) {
        const errMsg =
          (parsed && 'error' in parsed && parsed.error) || `Check-in failed: ${res.status}`;
        setError(errMsg);
        if (parsed && 'counter' in parsed && parsed.counter) {
          setItems((cs) => cs.map((c) => (c.id === id ? parsed.counter! : c)));
        }
        return null;
      }
      const row = parsed as CounterRow;
      setItems((cs) => cs.map((c) => (c.id === id ? row : c)));
      const stamped = day ?? today;
      setHistories((prev) => {
        const existing = prev[id] ?? new Set<string>();
        const next = new Set(existing);
        next.add(stamped);
        return { ...prev, [id]: next };
      });
      return row;
    },
    [today],
  );

  const renameCounter = useCallback(async (id: string, name: string) => {
    setError(null);
    const res = await fetch(`/api/counters/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Rename failed: ${res.status}`);
      return null;
    }
    const row = (await res.json()) as CounterRow;
    setItems((cs) => cs.map((c) => (c.id === id ? row : c)));
    return row;
  }, []);

  const deleteCounter = useCallback(async (id: string) => {
    setError(null);
    const res = await fetch(`/api/counters/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(`Delete failed: ${res.status}`);
      return false;
    }
    setItems((cs) => cs.filter((c) => c.id !== id));
    setHistories((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<CountersStore>(
    () => ({
      items,
      histories,
      loading,
      error,
      today,
      refresh,
      addCounter,
      checkIn,
      renameCounter,
      deleteCounter,
      clearError,
    }),
    [
      items,
      histories,
      loading,
      error,
      today,
      refresh,
      addCounter,
      checkIn,
      renameCounter,
      deleteCounter,
      clearError,
    ],
  );

  return <CountersContext.Provider value={value}>{children}</CountersContext.Provider>;
}
