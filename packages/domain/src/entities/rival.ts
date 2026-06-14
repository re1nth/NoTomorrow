import { z } from 'zod';
import { RivalArchetype } from '../enums.js';
import { DomainName, Id } from './primitives.js';

/**
 * Opponent surfaced on a user's leaderboard.
 * arch/02-domain-model.md → Rival
 */
export const Rival = z
  .object({
    userId: Id,
    archetype: RivalArchetype,
    domain: DomainName,
  })
  .strict();

export type Rival = z.infer<typeof Rival>;
