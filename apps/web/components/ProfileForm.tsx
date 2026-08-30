'use client';

import { SectionTitle } from '@/components/SectionTitle';
import { Button, Card } from '@/lib/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  initial: { id: string; handle: string; timezone: string; email: string | null };
  isCloud: boolean;
  onSignOut: (() => Promise<void>) | null;
}

export function ProfileForm({ initial, isCloud, onSignOut }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initial.timezone);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const dirty = timezone !== initial.timezone;
  const confirmed = confirmName.trim().toLowerCase() === initial.handle.toLowerCase();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      const patch: { timezone?: string } = {};
      if (timezone !== initial.timezone) patch.timezone = timezone.trim();
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setStatus({ kind: 'err', msg: body?.error ?? `Save failed (${res.status})` });
        return;
      }
      setStatus({ kind: 'ok', msg: 'Saved.' });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function detectBrowserTz() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // ignore — user can type manually
    }
  }

  async function deleteAccount() {
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/me', { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus({ kind: 'err', msg: body?.error ?? `Delete failed (${res.status})` });
        setDeleting(false);
        return;
      }
      // Session row is FK-cascaded away in cloud mode; the layout will
      // redirect to /login on the next authed navigation. Head home.
      window.location.href = '/';
    } catch (err) {
      setStatus({ kind: 'err', msg: (err as Error).message });
      setDeleting(false);
    }
  }

  return (
    <>
      <SectionTitle
        title="Profile"
        subtitle="Your profile lives on this device — or, in cloud mode, in your account."
      />

      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
      <form onSubmit={save} className="space-y-6">
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-charcoal">Handle</label>
            <div className="w-full rounded-md border border-charcoal/10 bg-canvas/60 px-3 py-2 text-sm text-charcoal-soft">
              {initial.handle}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="timezone" className="block text-sm font-medium text-charcoal">
              Timezone
            </label>
            <div className="flex gap-2">
              <input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 rounded-md border border-charcoal/20 bg-canvas px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-glove"
                autoComplete="off"
                spellCheck={false}
                placeholder="Europe/London"
              />
              <Button type="button" variant="secondary" onClick={detectBrowserTz}>
                Detect
              </Button>
            </div>
            <p className="text-xs text-charcoal-soft">
              IANA name. Controls which day &ldquo;+1 today&rdquo; counts toward.
            </p>
          </div>

          {initial.email ? (
            <div className="text-xs text-charcoal-soft">
              Signed in as <span className="font-medium text-charcoal">{initial.email}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {status ? (
              <span
                className={
                  status.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-red-500'
                }
              >
                {status.msg}
              </span>
            ) : null}
          </div>
        </Card>
      </form>

      {isCloud && onSignOut ? (
        <form action={onSignOut} className="mt-6">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      ) : null}

      <Card className="mt-8 space-y-3 border border-red-500/30 bg-red-500/5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-red-500">Danger zone</h2>
        <p className="text-sm text-charcoal-soft">
          Delete your account. This wipes every counter and check-in. There is no undo.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={`Type ${initial.handle} to confirm`}
            className="flex-1 rounded-md border border-red-500/40 bg-canvas px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-red-500"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={deleteAccount}
            disabled={!confirmed || deleting}
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      </Card>
        </div>
      </div>
    </>
  );
}
