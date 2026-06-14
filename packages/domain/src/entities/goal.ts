import { z } from 'zod';
import { GoalStatus, Horizon } from '../enums.js';
import { Id, IsoDate, IsoDateTime } from './primitives.js';

/**
 * Top-level user ambition.
 * arch/02-domain-model.md → Goal
 */
export const Goal = z
  .object({
    id: Id,
    userId: Id,
    title: z.string().min(1).max(200),
    motivation: z.string().max(2_000),
    horizon: Horizon,
    targetDate: IsoDate,
    status: GoalStatus,
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict();

export type Goal = z.infer<typeof Goal>;
