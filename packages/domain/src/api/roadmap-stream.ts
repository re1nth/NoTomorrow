import { z } from 'zod';
import { Milestone } from '../entities/milestone.js';
import { Id } from '../entities/primitives.js';

/**
 * SSE stream events emitted by POST /goals during roadmap generation,
 * and by the coach service POST /roadmap/generate.
 * arch/07-api.md → Streaming endpoints
 * arch/TRACKER.md → apps/coach interface contract
 */
export const RoadmapStreamEvent = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('goal_created'),
      goalId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal('milestone'),
      milestone: Milestone,
    })
    .strict(),
  z
    .object({
      type: z.literal('done'),
      roadmapId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal('error'),
      message: z.string(),
    })
    .strict(),
]);
export type RoadmapStreamEvent = z.infer<typeof RoadmapStreamEvent>;
