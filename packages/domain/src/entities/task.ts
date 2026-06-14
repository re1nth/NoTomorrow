import { z } from 'zod';
import { PunchType, TaskStatus } from '../enums.js';
import { Id, IsoDate } from './primitives.js';

/**
 * "Punch" — an atomic action under a Milestone.
 * arch/02-domain-model.md → Task
 */
export const Task = z
  .object({
    id: Id,
    milestoneId: Id,
    title: z.string().min(1).max(200),
    type: PunchType,
    estMinutes: z.number().int().positive(),
    dueDate: IsoDate,
    status: TaskStatus,
  })
  .strict();

export type Task = z.infer<typeof Task>;
