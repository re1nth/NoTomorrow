/**
 * Belt progression shared by the Counters list card and the per-counter
 * detail page. Every counter rises through these tiers; each tier's
 * `threshold` is the minimum count required to wear it, and the bar fills
 * within the current tier toward the next.
 */
export const BELTS = [
  { name: 'White', threshold: 0, hex: '#F5F1E6', ink: '#0B0908', sticker: '/stickers/white.png' },
  { name: 'Yellow', threshold: 7, hex: '#F2A668', ink: '#0B0908', sticker: '/stickers/yellow.png' },
  { name: 'Orange', threshold: 30, hex: '#E66B4A', ink: '#0B0908', sticker: '/stickers/orange.png' },
  { name: 'Green', threshold: 90, hex: '#5DAA5E', ink: '#0B0908', sticker: '/stickers/green.png' },
  { name: 'Blue', threshold: 180, hex: '#5479C2', ink: '#EAE4D6', sticker: '/stickers/blue.png' },
  { name: 'Brown', threshold: 365, hex: '#7A4B2A', ink: '#EAE4D6', sticker: '/stickers/brown.png' },
  { name: 'Black', threshold: 720, hex: '#0B0908', ink: '#EAE4D6', sticker: '/stickers/black.png' },
  { name: 'Black II', threshold: 1095, hex: '#2A1F3D', ink: '#EAE4D6', sticker: '/stickers/black-ii.png' },
  { name: 'Black III', threshold: 1825, hex: '#4B1E55', ink: '#EAE4D6', sticker: '/stickers/black-iii.png' },
  { name: 'Champion', threshold: 3650, hex: '#B73E63', ink: '#EAE4D6', sticker: '/stickers/champion.png' },
] as const;

export type Belt = (typeof BELTS)[number];

export type Category = 'Warmup' | 'Hanging' | 'Barrage';

export const CATEGORIES = [
  { name: 'Warmup', hex: '#F2A668', ink: '#0B0908' },
  { name: 'Hanging', hex: '#E66B4A', ink: '#0B0908' },
  { name: 'Barrage', hex: '#5479C2', ink: '#EAE4D6' },
] as const satisfies readonly { name: Category; hex: string; ink: string }[];

export function categoryFor(belt: Belt): Category {
  if (belt.threshold < 30) return 'Warmup';
  if (belt.threshold < 180) return 'Hanging';
  return 'Barrage';
}

export function beltFor(
  count: number,
): { current: Belt; next: Belt | null; progress: number } {
  let current: Belt = BELTS[0];
  let next: Belt | null = BELTS[1] ?? null;
  for (let i = 0; i < BELTS.length; i++) {
    const tier = BELTS[i];
    if (tier && count >= tier.threshold) {
      current = tier;
      next = BELTS[i + 1] ?? null;
    }
  }
  const span = next ? next.threshold - current.threshold : 1;
  const progress = next ? Math.min(1, (count - current.threshold) / span) : 1;
  return { current, next, progress };
}

export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
