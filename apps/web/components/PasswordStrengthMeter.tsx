'use client';

/**
 * Client-side password strength meter using the same zxcvbn wrapper
 * the server enforces on submit, so what the user sees ("OK" or above
 * required) matches what the server will actually accept.
 *
 * The zxcvbn dictionaries are ~200KB gzipped — that's fine on this
 * route since it's only rendered on /register and /reset-password.
 */
import { useMemo } from 'react';
import { MIN_SCORE, STRENGTH_LABELS, scorePassword } from '@/lib/password';

const BAR_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-red-500',
  1: 'bg-orange-500',
  2: 'bg-yellow-500',
  3: 'bg-emerald-500',
  4: 'bg-emerald-400',
};

export function PasswordStrengthMeter({
  password,
  userInputs,
}: {
  password: string;
  userInputs: string[];
}) {
  const report = useMemo(() => {
    if (!password) return null;
    return scorePassword(password, userInputs.filter(Boolean));
  }, [password, userInputs]);

  if (!password) {
    return (
      <p className="text-xs text-white/50">
        Use at least 8 characters. Aim for &ldquo;OK&rdquo; or better — mixing
        words, numbers, and symbols helps.
      </p>
    );
  }

  const score = report?.score ?? 0;
  const label = STRENGTH_LABELS[score];
  const barColor = BAR_COLORS[score];
  const filled = score + 1; // 1..5 segments

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-sm ${
              i < filled ? barColor : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className="text-xs flex justify-between gap-3">
        <span className={report?.acceptable ? 'text-emerald-400' : 'text-white/70'}>
          {label}
          {!report?.acceptable ? ` — need ${STRENGTH_LABELS[MIN_SCORE].toLowerCase()} or better` : ''}
        </span>
      </p>
      {report?.warning ? (
        <p className="text-xs text-white/60">{report.warning}</p>
      ) : null}
      {report?.suggestions?.length ? (
        <ul className="text-xs text-white/50 list-disc pl-4">
          {report.suggestions.slice(0, 2).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
