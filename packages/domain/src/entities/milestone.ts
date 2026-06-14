import { z } from 'zod';
import { MilestoneStatus } from '../enums.js';
import { Id, IsoDate } from './primitives.js';

/**
 * "Round" — a major checkpoint inside a roadmap.
 * arch/02-domain-model.md → Milestone
 */
export const Milestone = z
  .object({
    id: Id,
    roadmapId: Id,
    order: z.number().int().nonnegative(),
    title: z.string().min(1).max(200),
    deliverable: z.string().min(1).max(2_000),
    dueDate: IsoDate,
    status: MilestoneStatus,
  })
  .strict();

export type Milestone = z.infer<typeof Milestone>;
