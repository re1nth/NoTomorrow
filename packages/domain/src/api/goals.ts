import { z } from 'zod';
import { GoalStatus, Horizon } from '../enums.js';
import { Goal } from '../entities/goal.js';
import { Milestone } from '../entities/milestone.js';
import { Roadmap, RoadmapGraphNode } from '../entities/roadmap.js';
import { Id, IsoDate, IsoDateTime } from '../entities/primitives.js';

/**
 * REST contracts for /goals and /goals/:id/roadmap*.
 * arch/07-api.md → Goals & roadmaps
 */

export const CreateGoalRequest = z
  .object({
    title: z.string().min(1).max(200),
    motivation: z.string().max(2_000),
    horizon: Horizon,
    targetDate: IsoDate,
  })
  .strict();
export type CreateGoalRequest = z.infer<typeof CreateGoalRequest>;

export const CreateGoalResponse = Goal;
export type CreateGoalResponse = z.infer<typeof CreateGoalResponse>;

export const ListGoalsResponse = z.object({ goals: z.array(Goal) }).strict();
export type ListGoalsResponse = z.infer<typeof ListGoalsResponse>;

export const GetGoalResponse = z.object({ goal: Goal }).strict();
export type GetGoalResponse = z.infer<typeof GetGoalResponse>;

export const UpdateGoalRequest = z
  .object({
    title: z.string().min(1).max(200).optional(),
    motivation: z.string().max(2_000).optional(),
    status: GoalStatus.optional(),
  })
  .strict();
export type UpdateGoalRequest = z.infer<typeof UpdateGoalRequest>;

export const UpdateGoalResponse = Goal;
export type UpdateGoalResponse = z.infer<typeof UpdateGoalResponse>;

/** GET /goals/:id/roadmap — current roadmap + flattened milestones. */
export const GetRoadmapResponse = z
  .object({
    roadmap: Roadmap,
    milestones: z.array(Milestone),
  })
  .strict();
export type GetRoadmapResponse = z.infer<typeof GetRoadmapResponse>;

/** GET /goals/:id/roadmap/history — chronological list, newest first. */
export const RoadmapHistoryResponse = z
  .object({
    versions: z.array(
      z
        .object({
          roadmapId: Id,
          generatedAt: Roadmap.shape.generatedAt,
          modelVersion: Roadmap.shape.modelVersion,
        })
        .strict(),
    ),
  })
  .strict();
export type RoadmapHistoryResponse = z.infer<typeof RoadmapHistoryResponse>;

/** POST /goals/:id/roadmap/regenerate — force a recalibration. */
export const RegenerateRoadmapRequest = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();
export type RegenerateRoadmapRequest = z.infer<typeof RegenerateRoadmapRequest>;

/** POST /goals/:id/roadmap/accept — accept a proposed diff. */
export const AcceptRoadmapRequest = z
  .object({
    proposedRoadmapId: Id,
  })
  .strict();
export type AcceptRoadmapRequest = z.infer<typeof AcceptRoadmapRequest>;

export const AcceptRoadmapResponse = z.object({ roadmap: Roadmap }).strict();
export type AcceptRoadmapResponse = z.infer<typeof AcceptRoadmapResponse>;

/**
 * Coach Service POST /roadmap/recalibrate — weekly replan trigger.
 * arch/06-coach-loop.md → Weekly recalibration
 */
export const RecalibrateRoadmapRequest = z
  .object({
    userId: Id,
    goalId: Id,
    /** ISO week the recalibration covers (YYYY-Www). */
    isoWeek: z.string().regex(/^\d{4}-W\d{2}$/),
  })
  .strict();
export type RecalibrateRoadmapRequest = z.infer<typeof RecalibrateRoadmapRequest>;

/**
 * Recalibrate response — a *proposed* Roadmap version (not yet active) plus
 * a structured diff against the current roadmap. The diff is rendered for
 * the user to accept / reject / edit.
 */
export const RecalibrateRoadmapResponse = z
  .object({
    proposedRoadmap: Roadmap,
    diff: z
      .object({
        added: z.array(RoadmapGraphNode),
        removed: z.array(Id),
        retitled: z.array(
          z
            .object({
              id: Id,
              from: z.string(),
              to: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    generatedAt: IsoDateTime,
  })
  .strict();
export type RecalibrateRoadmapResponse = z.infer<typeof RecalibrateRoadmapResponse>;
