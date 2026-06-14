/**
 * Minimal className combinator — joins truthy class strings with a space.
 *
 * Intentionally tiny: we don't depend on clsx/tailwind-merge to keep the
 * peer dep surface small. Consumers can pass through string templates.
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v && v !== 0) continue;
    if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    } else {
      out.push(String(v));
    }
  }
  return out.join(' ');
}
