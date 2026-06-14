import { z } from 'zod';
import { Channel, CoachTone } from '../enums.js';
import { Id, IsoDateTime } from './primitives.js';

/**
 * Persona communication from coach to user.
 * arch/02-domain-model.md → CoachMessage
 */
export const CoachMessage = z
  .object({
    id: Id,
    userId: Id,
    channel: Channel,
    tone: CoachTone,
    body: z.string().min(1).max(4_000),
    /** Optional CTA — clicking takes the user to this Task. */
    ctaTaskId: Id.nullable(),
    sentAt: IsoDateTime,
    readAt: IsoDateTime.nullable(),
  })
  .strict();

export type CoachMessage = z.infer<typeof CoachMessage>;
