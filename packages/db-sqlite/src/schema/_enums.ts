/**
 * SQLite has no native enum. We re-export the Zod `.options` tuples from
 * `@notomorrow/domain` so column definitions can pass them to
 * `text({ enum: [...] as const })`. This keeps the SQLite schema bound to the
 * same source of truth as the Postgres schema in `packages/db`.
 */
import {
  Channel,
  CoachTone,
  GoalStatus,
  Horizon,
  MilestoneStatus,
  ProofKind,
  PunchType,
  RivalArchetype,
  TaskStatus,
} from '@notomorrow/domain/enums';

export const goalStatusValues = GoalStatus.options;
export const milestoneStatusValues = MilestoneStatus.options;
export const taskStatusValues = TaskStatus.options;
export const punchTypeValues = PunchType.options;
export const proofKindValues = ProofKind.options;
export const channelValues = Channel.options;
export const horizonValues = Horizon.options;
export const coachToneValues = CoachTone.options;
export const rivalArchetypeValues = RivalArchetype.options;
