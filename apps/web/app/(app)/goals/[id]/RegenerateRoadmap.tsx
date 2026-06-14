'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/lib/ui';

/**
 * Empty-state action on the goal detail page. Re-fires the SSE roadmap
 * generation against the existing goal row, then refreshes so the milestones
 * render. Idempotent at the route level: we always insert into the same
 * roadmap shell row created at goal creation time.
 */
export function RegenerateRoadmap({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    setProgress('Calling the coach…');
    try {
      const res = await fetch(`/api/goals/${goalId}/roadmap/stream`, { method: 'POST' });
      if (!res.ok || !res.body) {
        setError(`Stream failed: ${res.status}`);
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let count = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === 'milestone') {
              count += 1;
              setProgress(`Round ${count}: ${evt.milestone?.title ?? '…'}`);
            } else if (evt.type === 'done') {
              setProgress('Done. Refreshing…');
            } else if (evt.type === 'error') {
              setError(evt.message);
            }
          } catch {
            // ignore unparseable frame
          }
        }
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={regenerate} disabled={busy} variant="primary">
        {busy ? 'Generating…' : 'Generate roadmap'}
      </Button>
      {progress ? <p className="text-xs text-charcoal-soft">{progress}</p> : null}
      {error ? <p className="text-xs text-glove-deep">Error: {error}</p> : null}
    </div>
  );
}
