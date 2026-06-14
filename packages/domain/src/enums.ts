import { z } from 'zod';

/**
 * Goal lifecycle status.
 * See arch/02-domain-model.md → Status enums.
 */
export const GoalStatus = z.enum(['draft', 'active', 'paused', 'won', 'abandoned']);
export type GoalStatus = z.infer<typeof GoalStatus>;

/**
 * Milestone ("Round") lifecycle status.
 */
export const MilestoneStatus = z.enum(['locked', 'current', 'cleared', 'failed']);
export type MilestoneStatus = z.infer<typeof MilestoneStatus>;

/**
 * Task ("Punch") lifecycle status.
 */
export const TaskStatus = z.enum(['pending', 'submitted', 'verified', 'rejected']);
export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Punch taxonomy — encodes effort, drives UI iconography, feeds rating math.
 *
 * - jab          — under 30 min
 * - hook         — half-day
 * - uppercut     — full day
 * - dempsey_roll — multi-day milestone capstone
 *
 * Note: schema uses snake_case; UI may render the metaphor with a space
 * ("dempsey roll").
 */
export const PunchType = z.enum(['jab', 'hook', 'uppercut', 'dempsey_roll']);
export type PunchType = z.infer<typeof PunchType>;

/**
 * Proof artifact kind.
 */
export const ProofKind = z.enum(['repo', 'url', 'video', 'writeup']);
export type ProofKind = z.infer<typeof ProofKind>;

/**
 * Coach message delivery channel.
 */
export const Channel = z.enum(['inbox', 'push']);
export type Channel = z.infer<typeof Channel>;

/**
 * Goal time horizon.
 */
export const Horizon = z.enum(['1w', '1m', '3m', '1y']);
export type Horizon = z.infer<typeof Horizon>;

/**
 * Coach message tone. Inferred from coach persona surfaces; kept as a
 * narrow enum for downstream UI styling.
 */
export const CoachTone = z.enum(['hype', 'stern', 'analytical', 'warm']);
export type CoachTone = z.infer<typeof CoachTone>;

/**
 * Rival archetype label — used by leaderboard matching.
 */
export const RivalArchetype = z.enum(['mirror', 'nemesis', 'mentor', 'rookie']);
export type RivalArchetype = z.infer<typeof RivalArchetype>;
