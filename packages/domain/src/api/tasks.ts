import { z } from 'zod';
import { ProofKind } from '../enums.js';
import { ProofOfWork, ProofPayload } from '../entities/proof.js';
import { Task } from '../entities/task.js';

/**
 * arch/07-api.md → Milestones & tasks
 */

export const GetTaskResponse = z.object({ task: Task }).strict();
export type GetTaskResponse = z.infer<typeof GetTaskResponse>;

/** POST /tasks/:id/proof — payload kind must agree with the discriminator. */
export const SubmitProofRequest = z
  .object({
    kind: ProofKind,
    payload: ProofPayload,
  })
  .strict()
  .refine((v) => v.kind === v.payload.kind, {
    message: 'kind must match payload.kind',
    path: ['payload', 'kind'],
  });
export type SubmitProofRequest = z.infer<typeof SubmitProofRequest>;

export const SubmitProofResponse = z.object({ proof: ProofOfWork }).strict();
export type SubmitProofResponse = z.infer<typeof SubmitProofResponse>;

export const ListProofsResponse = z.object({ proofs: z.array(ProofOfWork) }).strict();
export type ListProofsResponse = z.infer<typeof ListProofsResponse>;

/**
 * Coach service /proof/grade response.
 * arch/TRACKER.md → apps/coach interface contract
 */
export const GradeProofResponse = z
  .object({
    shipped: z.boolean(),
    quality: z.number().int().min(1).max(5),
    gaps: z.array(z.string().min(1).max(500)),
  })
  .strict();
export type GradeProofResponse = z.infer<typeof GradeProofResponse>;
