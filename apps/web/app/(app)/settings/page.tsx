'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/lib/ui';

interface KeyState {
  configured: boolean;
  hint?: string;
  desktopOnly?: boolean;
}

/**
 * Settings page. Only meaningful in desktop mode — lets the user paste
 * their Anthropic API key, which the coach-client reads when generating
 * roadmaps. Persisted to `${userData}/settings.json` so it survives
 * relaunches. The web build mounts the page too but reports a
 * desktop-only notice.
 */
export default function SettingsPage() {
  const [state, setState] = useState<KeyState | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        setError(`Load failed: ${res.status}`);
        return;
      }
      const json = (await res.json()) as KeyState;
      setState(json);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anthropicApiKey: draft.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Save failed: ${res.status}`);
      return;
    }
    setDraft('');
    setSavedAt(new Date());
    await refresh();
  }

  return (
    <Card className="max-w-2xl mx-auto" tone="glove">
      <h1 className="font-display text-3xl mb-1">Settings</h1>
      <p className="text-sm text-charcoal-soft mb-4">
        Connect your Anthropic API key so the coach can plan your rounds.
      </p>

      {state?.desktopOnly ? (
        <p className="text-sm text-charcoal-soft">
          Settings are only configurable in the desktop app.
        </p>
      ) : (
        <>
          <div className="mb-4 text-sm">
            <span className="uppercase tracking-wider text-xs text-charcoal-soft mr-2">
              Anthropic key
            </span>
            {state?.configured ? (
              <span className="text-good">✓ {state.hint}</span>
            ) : (
              <span className="text-glove-deep">not set</span>
            )}
          </div>
          <form onSubmit={save} className="space-y-3">
            <label className="block text-sm">
              <span className="block mb-1 uppercase tracking-wider text-xs">
                Paste a new key
              </span>
              <input
                type="password"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-ant-…"
                className="w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove"
              />
            </label>
            {error ? <p className="text-sm text-glove-deep">{error}</p> : null}
            {savedAt ? (
              <p className="text-sm text-good">Saved at {savedAt.toLocaleTimeString()}</p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={saving || draft.trim().length < 10}
            >
              {saving ? 'Saving…' : 'Save key'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-charcoal-soft">
            Stored locally in your user-data folder. Not sent anywhere except api.anthropic.com.
          </p>
        </>
      )}
    </Card>
  );
}
