import { z } from 'zod';
import { Id, IsoDate } from './primitives.js';

/**
 * Daily check-in.
 * arch/02-domain-model.md → TrainingLog
 *
 * `mood` is 1..5 (terrible..great). `blockers` is free text.
 * `coachReply` is filled in asynchronously by the coach service.
 */
export const TrainingLog = z
  .object({
    id: Id,
    userId: Id,
    date: IsoDate,
    mood: z.number().int().min(1).max(5),
    hoursTrained: z.number().nonnegative().max(24),
    blockers: z.string().max(2_000),
    coachReply: z.string().max(2_000).nullable(),
  })
  .strict();

export type TrainingLog = z.infer<typeof TrainingLog>;
