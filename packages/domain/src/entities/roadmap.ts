import { z } from 'zod';
import { Id, IsoDateTime } from './primitives.js';

/**
 * A single node in the roadmap DAG. Each node is a stand-in for a
 * Milestone — kept loose here so the LLM stream can land before the
 * Milestone rows are persisted.
 */
export const RoadmapGraphNode = z
  .object({
    id: Id,
    title: z.string().min(1).max(200),
    /** Order index within the roadmap. */
    order: z.number().int().nonnegative(),
    /** Optional DAG dependencies; ids of upstream nodes that must clear first. */
    dependsOn: z.array(Id).default([]),
  })
  .strict();
export type RoadmapGraphNode = z.infer<typeof RoadmapGraphNode>;

/**
 * Plan generated for a Goal. A Goal has many Roadmaps over time; only the
 * latest is "current". Each one carries the model + prompt version that
 * produced it so we can diff/compare recalibrations.
 *
 * arch/02-domain-model.md → Roadmap
 */
export const Roadmap = z
  .object({
    id: Id,
    goalId: Id,
    generatedAt: IsoDateTime,
    modelVersion: z.string().min(1).max(128),
    graph: z.array(RoadmapGraphNode),
  })
  .strict();

export type Roadmap = z.infer<typeof Roadmap>;
