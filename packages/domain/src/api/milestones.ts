import { z } from 'zod';
import { Milestone } from '../entities/milestone.js';
import { Task } from '../entities/task.js';

/**
 * GET /milestones/:id — detail + child tasks.
 * arch/07-api.md → Milestones & tasks
 */
export const GetMilestoneResponse = z
  .object({
    milestone: Milestone,
    tasks: z.array(Task),
  })
  .strict();
export type GetMilestoneResponse = z.infer<typeof GetMilestoneResponse>;
