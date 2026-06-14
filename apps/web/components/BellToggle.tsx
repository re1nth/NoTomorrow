'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/ui';

const KEY = 'nt:bell:enabled';

/**
 * Tiny header toggle controlling the round-bell sound. Persisted to
 * localStorage so the preference survives a page reload.
 */
export function BellToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOn(window.localStorage.getItem(KEY) === '1');
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-pressed={on}>
      {on ? 'Bell: on' : 'Bell: off'}
    </Button>
  );
}
