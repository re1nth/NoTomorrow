/**
 * Postgres enum definitions, derived from `@notomorrow/domain` Zod enums.
 *
 * We pull the `.options` tuple off each Zod enum so the DB cannot drift from
 * the domain contract: changing a value in `@notomorrow/domain` shows up as a
 * type error here and as a fresh migration via drizzle-kit.
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
import { pgEnum } from 'drizzle-orm/pg-core';

// Helper: drizzle's pgEnum requires a readonly non-empty tuple of string
// literals. Zod's `.options` returns exactly that, but TS widens it through
// `readonly string[]` unless we assert the tuple shape.
const tuple = <T extends readonly [string, ...string[]]>(values: T): T => values;

export const goalStatusEnum = pgEnum('goal_status', tuple(GoalStatus.options));
export const milestoneStatusEnum = pgEnum('milestone_status', tuple(MilestoneStatus.options));
export const taskStatusEnum = pgEnum('task_status', tuple(TaskStatus.options));
export const punchTypeEnum = pgEnum('punch_type', tuple(PunchType.options));
export const proofKindEnum = pgEnum('proof_kind', tuple(ProofKind.options));
export const channelEnum = pgEnum('coach_channel', tuple(Channel.options));
export const horizonEnum = pgEnum('goal_horizon', tuple(Horizon.options));
export const coachToneEnum = pgEnum('coach_tone', tuple(CoachTone.options));
export const rivalArchetypeEnum = pgEnum('rival_archetype', tuple(RivalArchetype.options));
