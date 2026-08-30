'use client';

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

export type PomodoroMode = 'idle' | 'running' | 'paused' | 'ended';

interface DesktopBridge {
  pomodoroBuzz?: (opts?: { label?: string }) => void;
  pomodoroClear?: () => void;
}

function desktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { notomorrow?: DesktopBridge };
  return w.notomorrow ?? null;
}

// Two-tone WebAudio buzz — kept here (rather than in a util file) because
// the store owns the "timer ended" transition that triggers it.
function playBuzz(): void {
  if (typeof window === 'undefined') return;
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const beeps = [
      { at: 0, freq: 880 },
      { at: 0.22, freq: 660 },
      { at: 0.44, freq: 880 },
    ];
    for (const b of beeps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = b.freq;
      gain.gain.setValueAtTime(0.0001, now + b.at);
      gain.gain.exponentialRampToValueAtTime(0.35, now + b.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + b.at + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + b.at);
      osc.stop(now + b.at + 0.2);
    }
    setTimeout(() => void ctx.close().catch(() => undefined), 900);
  } catch {
    /* ignore — sound is opt-in cosmetic */
  }
}

interface PomodoroStore {
  totalMs: number;
  remainingMs: number;
  mode: PomodoroMode;
  setPreset: (minutes: number) => void;
  setCustom: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  stop: () => void;
  dismissEnded: () => void;
}

const PomodoroContext = createContext<PomodoroStore | null>(null);

export function usePomodoro(): PomodoroStore {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
}

/**
 * Session-scoped timer that lives in the (app) shell so switching between
 * /counters, /pomodoro, and /profile doesn't unmount the tick loop.
 *
 * The tick is driven off a wall-clock `endsAt` timestamp so a throttled
 * background browser tab still lands on the correct end time when it
 * regains focus; the interval just recomputes `endsAt - Date.now()`.
 */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [totalMs, setTotalMs] = useState<number>(30 * 60_000);
  const [remainingMs, setRemainingMs] = useState<number>(30 * 60_000);
  const [mode, setMode] = useState<PomodoroMode>('idle');
  const endsAtRef = useRef<number | null>(null);

  const running = mode === 'running';

  useEffect(() => {
    if (!running || endsAtRef.current == null) return;
    const id = setInterval(() => {
      const left = (endsAtRef.current ?? 0) - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setMode('ended');
        endsAtRef.current = null;
      } else {
        setRemainingMs(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Fire the alert exactly once when we enter `ended`.
  useEffect(() => {
    if (mode !== 'ended') return;
    playBuzz();
    const bridge = desktopBridge();
    bridge?.pomodoroBuzz?.({ label: 'Pomodoro' });
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const send = () =>
        new Notification('Pomodoro finished', {
          body: 'Time is up — take a breather.',
        });
      if (Notification.permission === 'granted') {
        try {
          send();
        } catch {
          /* ignore */
        }
      } else if (Notification.permission !== 'denied') {
        void Notification.requestPermission()
          .then((p) => {
            if (p === 'granted') send();
          })
          .catch(() => undefined);
      }
    }
  }, [mode]);

  const setPreset = useCallback((minutes: number) => {
    // Guarded on the caller side too, but re-check here so the store is safe
    // to drive from any surface (nav shortcut, future hotkey, etc.).
    setMode((prev) => {
      if (prev === 'running') return prev;
      const ms = minutes * 60_000;
      setTotalMs(ms);
      setRemainingMs(ms);
      endsAtRef.current = null;
      desktopBridge()?.pomodoroClear?.();
      return 'idle';
    });
  }, []);

  const setCustom = useCallback((minutes: number) => {
    setMode((prev) => {
      if (prev === 'running') return prev;
      const clamped = Math.min(180, Math.max(1, Math.round(minutes)));
      const ms = clamped * 60_000;
      setTotalMs(ms);
      setRemainingMs(ms);
      endsAtRef.current = null;
      desktopBridge()?.pomodoroClear?.();
      return 'idle';
    });
  }, []);

  const start = useCallback(() => {
    setRemainingMs((left) => {
      if (left <= 0) return left;
      endsAtRef.current = Date.now() + left;
      setMode('running');
      desktopBridge()?.pomodoroClear?.();
      return left;
    });
  }, []);

  const pause = useCallback(() => {
    if (endsAtRef.current == null) return;
    const left = Math.max(0, endsAtRef.current - Date.now());
    setRemainingMs(left);
    endsAtRef.current = null;
    setMode('paused');
  }, []);

  const stop = useCallback(() => {
    endsAtRef.current = null;
    setRemainingMs(totalMs);
    setMode('idle');
    desktopBridge()?.pomodoroClear?.();
  }, [totalMs]);

  const dismissEnded = useCallback(() => {
    endsAtRef.current = null;
    setRemainingMs(totalMs);
    setMode('idle');
    desktopBridge()?.pomodoroClear?.();
  }, [totalMs]);

  const value = useMemo<PomodoroStore>(
    () => ({
      totalMs,
      remainingMs,
      mode,
      setPreset,
      setCustom,
      start,
      pause,
      stop,
      dismissEnded,
    }),
    [totalMs, remainingMs, mode, setPreset, setCustom, start, pause, stop, dismissEnded],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}
