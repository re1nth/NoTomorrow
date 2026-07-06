'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@/lib/ui';

type Mode = 'idle' | 'running' | 'paused' | 'ended';

const PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr', minutes: 60 },
] as const;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface DesktopBridge {
  pomodoroBuzz?: (opts?: { label?: string }) => void;
  pomodoroClear?: () => void;
}

function desktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { notomorrow?: DesktopBridge };
  return w.notomorrow ?? null;
}

/**
 * Play a short two-tone buzz using WebAudio — avoids shipping an audio asset.
 * No-op if the AudioContext can't start (e.g. autoplay blocked pre-gesture,
 * though a Start click will unlock it).
 */
function playBuzz(): void {
  if (typeof window === 'undefined') return;
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
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

export default function PomodoroPage() {
  const [totalMs, setTotalMs] = useState<number>(30 * 60_000);
  const [remainingMs, setRemainingMs] = useState<number>(30 * 60_000);
  const [mode, setMode] = useState<Mode>('idle');
  const [custom, setCustom] = useState<string>('');
  const endsAtRef = useRef<number | null>(null);

  const running = mode === 'running';
  const ended = mode === 'ended';

  // Tick loop — recomputes remaining from wall-clock endsAt so a throttled
  // background tab still lands on the correct end time.
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
    if (mode === 'running') return;
    const ms = minutes * 60_000;
    setTotalMs(ms);
    setRemainingMs(ms);
    setMode('idle');
    setCustom('');
    endsAtRef.current = null;
    desktopBridge()?.pomodoroClear?.();
  }, [mode]);

  const applyCustom = useCallback(() => {
    const n = Number(custom);
    if (!Number.isFinite(n) || n <= 0) return;
    const clamped = Math.min(180, Math.max(1, Math.round(n)));
    const ms = clamped * 60_000;
    setTotalMs(ms);
    setRemainingMs(ms);
    setMode('idle');
    endsAtRef.current = null;
    desktopBridge()?.pomodoroClear?.();
  }, [custom]);

  const start = useCallback(() => {
    if (remainingMs <= 0) return;
    endsAtRef.current = Date.now() + remainingMs;
    setMode('running');
    desktopBridge()?.pomodoroClear?.();
  }, [remainingMs]);

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
    setRemainingMs(totalMs);
    setMode('idle');
    desktopBridge()?.pomodoroClear?.();
  }, [totalMs]);

  const percentDone = useMemo(() => {
    if (totalMs <= 0) return 0;
    return Math.min(100, Math.max(0, 100 - (remainingMs / totalMs) * 100));
  }, [remainingMs, totalMs]);

  const activePresetMinutes =
    mode === 'idle' && custom === '' ? Math.round(totalMs / 60_000) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wider">Pomodoro</h1>
        <span className="text-sm text-charcoal-soft font-display uppercase tracking-wider">
          {mode === 'running'
            ? 'Running'
            : mode === 'paused'
              ? 'Paused'
              : mode === 'ended'
                ? 'Done'
                : 'Ready'}
        </span>
      </div>

      <Card>
        <div className="flex flex-col items-center gap-6 py-6">
          <div
            className={`font-display text-7xl tabular-nums transition-colors ${
              ended ? 'text-glove animate-pulse' : 'text-charcoal'
            }`}
            aria-live="polite"
          >
            {formatClock(remainingMs)}
          </div>
          <div className="w-full h-2 bg-charcoal/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-[width] duration-200 ${
                ended ? 'bg-glove' : 'bg-charcoal'
              }`}
              style={{ width: `${percentDone}%` }}
            />
          </div>

          <div className="flex gap-3">
            {ended ? (
              <Button variant="primary" onClick={dismissEnded}>
                Dismiss
              </Button>
            ) : running ? (
              <>
                <Button variant="ghost" onClick={pause}>
                  Pause
                </Button>
                <Button variant="ghost" onClick={stop}>
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={start} disabled={remainingMs <= 0}>
                  {mode === 'paused' ? 'Resume' : 'Start'}
                </Button>
                {mode === 'paused' && (
                  <Button variant="ghost" onClick={stop}>
                    Stop
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="text-xs font-display uppercase tracking-wider text-charcoal-soft">
            Duration
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = activePresetMinutes === p.minutes;
              return (
                <Button
                  key={p.minutes}
                  variant={active ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreset(p.minutes)}
                  disabled={mode === 'running'}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              placeholder="Custom minutes"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              disabled={mode === 'running'}
              className="w-40 px-3 py-2 rounded border border-charcoal/20 bg-canvas text-sm font-display disabled:opacity-50"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={applyCustom}
              disabled={mode === 'running' || custom === ''}
            >
              Set
            </Button>
          </div>
          <p className="text-xs text-charcoal-soft">
            1–180 minutes. Presets and custom values are locked while a timer is
            running.
          </p>
        </div>
      </Card>
    </div>
  );
}
