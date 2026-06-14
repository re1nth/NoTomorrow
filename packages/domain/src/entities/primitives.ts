import { z } from 'zod';

/**
 * Shared primitive schemas used across entities. Centralised so the JSON
 * Schema export reuses one definition per primitive.
 */

export const Id = z.string().uuid();
export type Id = z.infer<typeof Id>;

/** ISO-8601 datetime, validated as a JSON-friendly string. */
export const IsoDateTime = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** ISO-8601 calendar date (YYYY-MM-DD). */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
export type IsoDate = z.infer<typeof IsoDate>;

/** IANA timezone identifier (e.g. "America/Los_Angeles"). */
export const Timezone = z.string().min(1);
export type Timezone = z.infer<typeof Timezone>;

/**
 * Domain label — e.g. "web-frontend", "ml-research".
 *
 * arch/02-domain-model.md leaves the taxonomy open; arch/09-risks.md
 * flags this. Treated as a free-form string here so onboarding can ship;
 * tighten to an enum once the taxonomy stabilises.
 */
export const DomainName = z.string().min(1).max(64);
export type DomainName = z.infer<typeof DomainName>;

/** Elo-style integer rating. */
export const Rating = z.number().int().nonnegative();
export type Rating = z.infer<typeof Rating>;
