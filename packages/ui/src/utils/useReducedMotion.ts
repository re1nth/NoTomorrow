import { useEffect, useState } from 'react';

/**
 * SSR-safe `prefers-reduced-motion` hook.
 *
 * Returns `true` when the user has explicitly requested reduced motion via
 * their OS / browser settings. All animated components in this package must
 * honour this and either disable or simplify their motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    // Older Safari: addListener; modern: addEventListener
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return reduced;
}
