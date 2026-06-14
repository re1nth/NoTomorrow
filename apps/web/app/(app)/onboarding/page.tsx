'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card } from '@/lib/ui';
import {
  WEB_FRONTEND_DIAGNOSTIC,
  ratingFromScore,
  scoreDiagnostic,
} from './diagnostic';

/**
 * 10-question diagnostic — single screen with progressive disclosure. On
 * submit we POST a synthetic rating event so the user lands on /gym with a
 * non-zero rating; the daily-coach loop takes over from there.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ stamina: number; expertise: number } | null>(null);

  const answered = Object.keys(answers).length;
  const total = WEB_FRONTEND_DIAGNOSTIC.length;

  async function onSubmit() {
    setSubmitting(true);
    const score = scoreDiagnostic(answers);
    const rating = ratingFromScore(score);
    setDone(rating);
    // We don't yet have a dedicated /api/onboarding endpoint — the diagnostic
    // result is rendered locally and the rating will be seeded the first time
    // the daily-coach job fires. UI surface is ready for that handoff.
    setSubmitting(false);
  }

  if (done) {
    return (
      <Card tone="ko" className="max-w-xl mx-auto text-center">
        <h2 className="font-display text-3xl mb-2">Ready, fighter.</h2>
        <p className="text-charcoal-soft mb-4">
          Starting rating: stamina <strong>{done.stamina}</strong> · expertise{' '}
          <strong>{done.expertise}</strong>
        </p>
        <Button onClick={() => router.push('/goals/new')} variant="primary" size="lg">
          Set your first goal
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">Diagnostic — web-frontend</h1>
        <p className="text-charcoal-soft text-sm">
          Ten quick questions so the coach knows where to start.{' '}
          <span className="font-semibold">{answered}</span> / {total} answered.
        </p>
      </header>
      <div className="space-y-4">
        {WEB_FRONTEND_DIAGNOSTIC.map((q, idx) => (
          <Card key={q.id}>
            <p className="font-medium mb-2">
              {idx + 1}. {q.prompt}
            </p>
            <div className="space-y-1">
              {q.choices.map((c) => (
                <label key={c.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    value={c.id}
                    checked={answers[q.id] === c.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={answered < total || submitting}
        onClick={onSubmit}
      >
        {submitting ? 'Tallying…' : 'See my rating'}
      </Button>
    </div>
  );
}
