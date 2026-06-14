'use client';

import { useState } from 'react';
import { Button } from '@/lib/ui';

/**
 * URL-only proof submission for MVP. Other ProofKinds are deferred.
 */
export function SubmitProofForm({ taskId }: { taskId: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'ok' | string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/tasks/${taskId}/proof`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'url',
        payload: { kind: 'url', url },
      }),
    });
    setBusy(false);
    if (res.ok) {
      setResult('ok');
      setUrl('');
    } else {
      setResult(`Failed: ${res.status}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input
        type="url"
        required
        placeholder="https://your-deployed.app"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-glove"
      />
      <Button type="submit" variant="primary" size="sm" disabled={busy}>
        {busy ? 'Sending…' : 'Submit proof'}
      </Button>
      {result === 'ok' ? (
        <p className="text-xs text-charcoal-soft">
          Submitted. The coach will grade it shortly.
        </p>
      ) : result ? (
        <p className="text-xs text-glove-deep">{result}</p>
      ) : null}
    </form>
  );
}
