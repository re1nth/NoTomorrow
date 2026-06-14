import { z } from 'zod';
import { RatingEvent } from '../entities/rating-event.js';
import { RatingProfile } from '../entities/rating-profile.js';
import { IsoDateTime, Rating } from '../entities/primitives.js';

/**
 * arch/07-api.md → Training & ratings
 */

export const ListRatingsResponse = z.object({ profiles: z.array(RatingProfile) }).strict();
export type ListRatingsResponse = z.infer<typeof ListRatingsResponse>;

export const RatingDetailResponse = z
  .object({
    profile: RatingProfile,
    recentEvents: z.array(RatingEvent),
  })
  .strict();
export type RatingDetailResponse = z.infer<typeof RatingDetailResponse>;

/** GET /rating/:domain/history — sparkline points. */
export const RatingHistoryResponse = z
  .object({
    points: z.array(
      z
        .object({
          at: IsoDateTime,
          stamina: Rating,
          expertise: Rating,
        })
        .strict(),
    ),
  })
  .strict();
export type RatingHistoryResponse = z.infer<typeof RatingHistoryResponse>;
