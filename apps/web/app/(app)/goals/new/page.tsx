'use client';

import { useState } from 'react';
import { Button, Card } from '@/lib/ui';
import { RoadmapStreamer } from './RoadmapStreamer';

/**
 * Goal creator. Two-stage:
 *   1. Form → POST /api/goals (returns the goal id synchronously).
 *   2. Mount <RoadmapStreamer/> to stream milestones via SSE.
 */
export default function NewGoalPage() {
  const [form, setForm] = useState({
    title: '',
    motivation: '',
    horizon: '1m',
    targetDate: defaultTargetDate(),
  });
  const [creating, setCreating] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (!res.ok) {
      setError(`Create failed: ${res.status}`);
      return;
    }
    const goal = await res.json();
    setGoalId(goal.id);
  }

  if (goalId) {
    return (
      <div className="max-w-2xl mx-auto">
        <RoadmapStreamer goalId={goalId} />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto" tone="glove">
      <h1 className="font-display text-3xl mb-1">New goal</h1>
      <p className="text-sm text-charcoal-soft mb-4">
        Be specific. Vague goals make vague roadmaps.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Title">
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <Field label="Why does this matter?">
          <textarea
            value={form.motivation}
            onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))}
            className={`${inputCls} min-h-24`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horizon">
            <select
              value={form.horizon}
              onChange={(e) => setForm((f) => ({ ...f, horizon: e.target.value }))}
              className={inputCls}
            >
              <option value="1w">1 week</option>
              <option value="1m">1 month</option>
              <option value="3m">3 months</option>
              <option value="1y">1 year</option>
            </select>
          </Field>
          <Field label="Target date">
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>
        {error ? <p className="text-sm text-glove-deep">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" block disabled={creating}>
          {creating ? 'Creating…' : 'Create goal & generate roadmap'}
        </Button>
      </form>
    </Card>
  );
}

const inputCls =
  'w-full rounded-glove border border-charcoal/20 bg-canvas-soft px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-glove';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 uppercase tracking-wider text-xs">{label}</span>
      {children}
    </label>
  );
}

function defaultTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
