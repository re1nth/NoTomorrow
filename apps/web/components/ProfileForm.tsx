'use client';

import { SectionTitle } from '@/components/SectionTitle';
import {
  HANDLE_MAX,
  HANDLE_MIN,
  isValidHandle,
  normalizeHandle,
} from '@/lib/handle';
import { Button, Card } from '@/lib/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type SVGProps } from 'react';

interface Props {
  initial: { id: string; handle: string; timezone: string; email: string | null };
  isCloud: boolean;
  onSignOut: (() => Promise<void>) | null;
}

// Debounce window before the availability check fires. Short enough that
// results feel live while typing; long enough that fast typing doesn't
// spam the server with per-keystroke fetches.
const HANDLE_CHECK_DEBOUNCE_MS = 300;

type HandleCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'invalid' }
  | { state: 'taken' }
  | { state: 'available' }
  | { state: 'current' };

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
          <HandleField initialHandle={initial.handle} />

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

/**
 * Handle field — read-only by default with a pencil-icon toggle. Clicking
 * the pencil opens an inline editor with a debounced availability check
 * and its own Save / Cancel, so changing your public identity is always a
 * deliberate action rather than something you might do by accident on a
 * form focused on other fields.
 */
function HandleField({ initialHandle }: { initialHandle: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialHandle);
  const [check, setCheck] = useState<HandleCheck>({ state: 'current' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const normalized = normalizeHandle(value);
  const changed = normalized !== initialHandle;
  const canSubmit = editing && changed && check.state === 'available' && !saving;

  useEffect(() => {
    if (!editing) return;
    if (!changed) {
      setCheck({ state: 'current' });
      return;
    }
    if (!isValidHandle(normalized)) {
      setCheck({ state: 'invalid' });
      return;
    }
    setCheck({ state: 'checking' });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/me/handle-available?value=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setCheck({ state: 'invalid' });
          return;
        }
        const body = (await res.json()) as { available: boolean; reason?: string };
        if (body.reason === 'current') setCheck({ state: 'current' });
        else if (body.reason === 'taken') setCheck({ state: 'taken' });
        else if (body.reason === 'invalid') setCheck({ state: 'invalid' });
        else if (body.available) setCheck({ state: 'available' });
        else setCheck({ state: 'taken' });
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return;
        setCheck({ state: 'invalid' });
      }
    }, HANDLE_CHECK_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized, changed, editing]);

  function beginEdit() {
    setErr(null);
    setValue(initialHandle);
    setCheck({ state: 'current' });
    setEditing(true);
  }

  function cancelEdit() {
    setValue(initialHandle);
    setCheck({ state: 'current' });
    setErr(null);
    setEditing(false);
  }

  async function saveHandle() {
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: normalized }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setCheck({ state: 'taken' });
        setErr(body?.error ?? `Save failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-charcoal">Handle</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-charcoal/10 bg-canvas/60 px-3 py-2 text-sm text-charcoal-soft">
            {initialHandle}
          </div>
          <button
            type="button"
            onClick={beginEdit}
            aria-label="Edit handle"
            title="Edit handle"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-charcoal/20 bg-canvas-soft text-charcoal-soft hover:text-charcoal hover:border-charcoal/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glove"
          >
            <PencilIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="handle" className="block text-sm font-medium text-charcoal">
        Handle
      </label>
      <div className="relative">
        <input
          id="handle"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setValue((v) => normalizeHandle(v))}
          maxLength={HANDLE_MAX}
          className="w-full rounded-md border border-charcoal/20 bg-canvas pl-3 pr-24 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-glove"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="your-handle"
        />
        <HandleCheckBadge check={check} changed={changed} />
      </div>
      <HandleHelpText check={check} changed={changed} />
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="primary" onClick={saveHandle} disabled={!canSubmit}>
          {saving ? 'Saving…' : 'Save handle'}
        </Button>
        <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>
          Cancel
        </Button>
        {err ? <span className="text-sm text-red-500">{err}</span> : null}
      </div>
    </div>
  );
}

function HandleCheckBadge({ check, changed }: { check: HandleCheck; changed: boolean }) {
  if (!changed) return null;
  const s = check.state;
  const label =
    s === 'checking'
      ? 'Checking…'
      : s === 'available'
        ? '✓ Available'
        : s === 'taken'
          ? '✗ Taken'
          : s === 'invalid'
            ? 'Invalid'
            : null;
  if (!label) return null;
  const tone =
    s === 'available'
      ? 'text-emerald-500'
      : s === 'checking'
        ? 'text-charcoal-soft'
        : 'text-red-500';
  return (
    <span
      className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${tone}`}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function HandleHelpText({ check, changed }: { check: HandleCheck; changed: boolean }) {
  if (changed && check.state === 'invalid') {
    return (
      <p className="text-xs text-red-500">
        {HANDLE_MIN}–{HANDLE_MAX} chars. Lowercase letters, digits, `_` or `-`.
        Must start and end with a letter or number.
      </p>
    );
  }
  return (
    <p className="text-xs text-charcoal-soft">
      Your public username. {HANDLE_MIN}–{HANDLE_MAX} chars, lowercase.
    </p>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
