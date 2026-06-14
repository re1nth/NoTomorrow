import { z } from 'zod';
import { Id, IsoDateTime, Timezone } from './primitives.js';

/**
 * Account + identity.
 * arch/02-domain-model.md → User
 */
export const User = z
  .object({
    id: Id,
    handle: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, 'handle: alphanumeric, dash, underscore only'),
    avatar: z.string().url().nullable(),
    timezone: Timezone,
    joinedAt: IsoDateTime,
  })
  .strict();

export type User = z.infer<typeof User>;
