import { z } from 'zod';
import { RatingProfile } from '../entities/rating-profile.js';
import { Rival } from '../entities/rival.js';
import { User } from '../entities/user.js';

/**
 * arch/07-api.md → Rivals & bundles
 */

export const ListRivalsResponse = z.object({ rivals: z.array(Rival) }).strict();
export type ListRivalsResponse = z.infer<typeof ListRivalsResponse>;

/** GET /rivals/:userId — public profile slice. */
export const RivalProfileResponse = z
  .object({
    user: User.pick({ id: true, handle: true, avatar: true }),
    ratings: z.array(RatingProfile),
    fightHistory: z.array(
      z
        .object({
          summary: z.string().min(1).max(500),
          when: User.shape.joinedAt,
        })
        .strict(),
    ),
  })
  .strict();
export type RivalProfileResponse = z.infer<typeof RivalProfileResponse>;
