import { z } from 'zod';
import { DomainName, Id, IsoDateTime } from './primitives.js';

/**
 * Atomic change to a RatingProfile. Every rating move writes one so the
 * "fight history" view can render *why* a rating moved.
 *
 * arch/02-domain-model.md → RatingEvent
 * arch/03-rating-system.md → "No silent updates."
 */
export const RatingEvent = z
  .object({
    id: Id,
    userId: Id,
    domain: DomainName,
    delta: z
      .object({
        stamina: z.number().int(),
        expertise: z.number().int(),
      })
      .strict(),
    reason: z.string().min(1).max(500),
    sourceProofId: Id.nullable(),
    occurredAt: IsoDateTime,
  })
  .strict();

export type RatingEvent = z.infer<typeof RatingEvent>;
