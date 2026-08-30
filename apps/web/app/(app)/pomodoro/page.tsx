'use client';

import { useCallback, useMemo, useState } from 'react';
import { SectionTitle } from '@/components/SectionTitle';
import { usePomodoro } from '@/components/PomodoroStore';
import { Button, Card } from '@/lib/ui';

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

export default function PomodoroPage() {
  const {
    totalMs,
    remainingMs,
    mode,
    setPreset,
    setCustom,
    start,
    pause,
    stop,
    dismissEnded,
  } = usePomodoro();
  const [customInput, setCustomInput] = useState<string>('');

  const running = mode === 'running';
  const ended = mode === 'ended';

  const applyCustom = useCallback(() => {
    const n = Number(customInput);
    if (!Number.isFinite(n) || n <= 0) return;
    setCustom(n);
    setCustomInput('');
  }, [customInput, setCustom]);

  const percentDone = useMemo(() => {
    if (totalMs <= 0) return 0;
    return Math.min(100, Math.max(0, 100 - (remainingMs / totalMs) * 100));
  }, [remainingMs, totalMs]);

  const activePresetMinutes =
    mode === 'idle' && customInput === '' ? Math.round(totalMs / 60_000) : null;

  return (
    <>
      <SectionTitle
        title="Pomodoro"
        subtitle="One bell, one round. Don't look away till it rings."
        right={
          <span className="text-sm text-charcoal-soft font-display uppercase tracking-wider">
            {mode === 'running'
              ? 'Running'
              : mode === 'paused'
                ? 'Paused'
                : mode === 'ended'
                  ? 'Done'
                  : 'Ready'}
          </span>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
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
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                disabled={mode === 'running'}
                className="w-40 px-3 py-2 rounded border border-charcoal/20 bg-canvas text-sm font-display disabled:opacity-50"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={applyCustom}
                disabled={mode === 'running' || customInput === ''}
              >
                Set
              </Button>
            </div>
            <p className="text-xs text-charcoal-soft">
              1–180 minutes. Presets and custom values are locked while a timer is running.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
