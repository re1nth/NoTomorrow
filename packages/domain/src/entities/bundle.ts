import { z } from 'zod';
import { Id, IsoDateTime } from './primitives.js';

/**
 * Reusable goal template. Forks become new Goals.
 * arch/02-domain-model.md → Bundle
 */
export const Bundle = z
  .object({
    id: Id,
    authorId: Id,
    sourceGoalId: Id,
    title: z.string().min(1).max(200),
    description: z.string().max(2_000).default(''),
    tags: z.array(z.string().min(1).max(32)).max(16),
    stars: z.number().int().nonnegative(),
    forks: z.number().int().nonnegative(),
    createdAt: IsoDateTime,
  })
  .strict();

export type Bundle = z.infer<typeof Bundle>;
