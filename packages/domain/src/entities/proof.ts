import { z } from 'zod';
import { ProofKind } from '../enums.js';
import { Id, IsoDateTime } from './primitives.js';

/**
 * Discriminated payload by proof kind. Keeping the shape narrow per kind
 * means the coach service can route to the right verifier without
 * inspecting the body twice.
 */
export const RepoProofPayload = z
  .object({
    kind: z.literal('repo'),
    url: z.string().url(),
    /** Optional commit SHA to pin verification to. */
    commitSha: z.string().min(7).max(64).optional(),
  })
  .strict();

export const UrlProofPayload = z
  .object({
    kind: z.literal('url'),
    url: z.string().url(),
  })
  .strict();

export const VideoProofPayload = z
  .object({
    kind: z.literal('video'),
    url: z.string().url(),
    durationSeconds: z.number().int().positive().optional(),
  })
  .strict();

export const WriteupProofPayload = z
  .object({
    kind: z.literal('writeup'),
    markdown: z.string().min(1).max(50_000),
  })
  .strict();

export const ProofPayload = z.discriminatedUnion('kind', [
  RepoProofPayload,
  UrlProofPayload,
  VideoProofPayload,
  WriteupProofPayload,
]);
export type ProofPayload = z.infer<typeof ProofPayload>;

/**
 * ProofOfWork — evidence attached to a Task.
 * arch/02-domain-model.md → ProofOfWork
 *
 * `score` is the LLM quality grade (1..5) used by the rating math in
 * arch/03-rating-system.md. Null until graded.
 */
export const ProofOfWork = z
  .object({
    id: Id,
    taskId: Id,
    kind: ProofKind,
    payload: ProofPayload,
    submittedAt: IsoDateTime,
    verifiedAt: IsoDateTime.nullable(),
    score: z.number().int().min(1).max(5).nullable(),
  })
  .strict();

export type ProofOfWork = z.infer<typeof ProofOfWork>;
