import { z } from 'zod';
import { Bundle } from '../entities/bundle.js';
import { Goal } from '../entities/goal.js';
import { DomainName, Id } from '../entities/primitives.js';

/**
 * arch/07-api.md → Rivals & bundles
 */

export const BundleSearchQuery = z
  .object({
    q: z.string().max(200).optional(),
    domain: DomainName.optional(),
  })
  .strict();
export type BundleSearchQuery = z.infer<typeof BundleSearchQuery>;

export const BundleSearchResponse = z.object({ bundles: z.array(Bundle) }).strict();
export type BundleSearchResponse = z.infer<typeof BundleSearchResponse>;

export const BundleDetailResponse = z.object({ bundle: Bundle }).strict();
export type BundleDetailResponse = z.infer<typeof BundleDetailResponse>;

export const PublishBundleRequest = z
  .object({
    sourceGoalId: Id,
    title: z.string().min(1).max(200),
    description: z.string().max(2_000).default(''),
    tags: z.array(z.string().min(1).max(32)).max(16),
  })
  .strict();
export type PublishBundleRequest = z.infer<typeof PublishBundleRequest>;

export const PublishBundleResponse = z.object({ bundle: Bundle }).strict();
export type PublishBundleResponse = z.infer<typeof PublishBundleResponse>;

/** POST /bundles/:id/fork — clones a bundle into a new Goal. */
export const ForkBundleResponse = z.object({ goal: Goal }).strict();
export type ForkBundleResponse = z.infer<typeof ForkBundleResponse>;

/** POST /bundles/:id/star — toggle. */
export const StarBundleResponse = z
  .object({
    starred: z.boolean(),
    stars: Bundle.shape.stars,
  })
  .strict();
export type StarBundleResponse = z.infer<typeof StarBundleResponse>;
