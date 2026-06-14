'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/lib/ui';

interface MilestoneSummary {
  id: string;
  title: string;
  order: number;
}

/**
 * Drives the SSE roadmap stream after a goal has been created.
 *
 * `POST /api/goals` returns the goal synchronously; `POST
 * /api/goals/:id/roadmap/stream` streams milestones. We render them as they
 * land so the user feels the coach planning live.
 */
export function RoadmapStreamer({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/goals/${goalId}/roadmap/stream`, {
          method: 'POST',
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setError(`Stream failed: ${res.status}`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = raw.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === 'milestone') {
              setMilestones((prev) => [...prev, evt.milestone]);
            } else if (evt.type === 'done') {
              setDone(true);
            } else if (evt.type === 'error') {
              setError(evt.message);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      }
    })();
    return () => controller.abort();
  }, [goalId]);

  return (
    <Card tone="glove">
      <h2 className="font-display text-2xl mb-2">Generating roadmap…</h2>
      {error ? (
        <p className="text-glove-deep text-sm">Error: {error}</p>
      ) : (
        <ol className="space-y-2 list-decimal list-inside">
          {milestones
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((m) => (
              <li key={m.id} className="text-sm">
                {m.title}
              </li>
            ))}
        </ol>
      )}
      {done ? (
        <div className="mt-4">
          <Button onClick={() => router.push(`/goals/${goalId}`)}>See roadmap</Button>
        </div>
      ) : null}
    </Card>
  );
}
