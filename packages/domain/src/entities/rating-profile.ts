import { z } from 'zod';
import { DomainName, Id, IsoDateTime, Rating } from './primitives.js';

/**
 * Per-domain Elo. One row per (user, domain).
 * arch/02-domain-model.md → RatingProfile
 * arch/03-rating-system.md → Stamina + Expertise (baseline 1200)
 */
export const RatingProfile = z
  .object({
    userId: Id,
    domain: DomainName,
    stamina: Rating,
    expertise: Rating,
    lastUpdated: IsoDateTime,
  })
  .strict();

export type RatingProfile = z.infer<typeof RatingProfile>;
