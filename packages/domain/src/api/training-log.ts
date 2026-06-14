import { z } from 'zod';
import { TrainingLog } from '../entities/training-log.js';
import { IsoDate } from '../entities/primitives.js';

/**
 * arch/07-api.md → Training & ratings
 */

export const CreateTrainingLogRequest = z
  .object({
    date: IsoDate,
    mood: z.number().int().min(1).max(5),
    hoursTrained: z.number().nonnegative().max(24),
    blockers: z.string().max(2_000),
  })
  .strict();
export type CreateTrainingLogRequest = z.infer<typeof CreateTrainingLogRequest>;

export const CreateTrainingLogResponse = z.object({ log: TrainingLog }).strict();
export type CreateTrainingLogResponse = z.infer<typeof CreateTrainingLogResponse>;

export const TrainingLogHistoryQuery = z
  .object({
    from: IsoDate.optional(),
    to: IsoDate.optional(),
  })
  .strict();
export type TrainingLogHistoryQuery = z.infer<typeof TrainingLogHistoryQuery>;

export const TrainingLogHistoryResponse = z.object({ logs: z.array(TrainingLog) }).strict();
export type TrainingLogHistoryResponse = z.infer<typeof TrainingLogHistoryResponse>;
