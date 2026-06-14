/**
 * `verify-proof` — on-demand verification triggered by `apps/web` after a
 * user submits a ProofOfWork.
 *
 * Flow (arch/06-coach-loop.md → On proof submission):
 *   1. Look up the proof + parent goal's domain.
 *   2. Call Coach `/proof/grade` (Claude Opus, structured output).
 *   3. On pass — write a `RatingEvent` (delta from arch/03-rating-system.md).
 *      On fail — write a `CoachMessage` with revision asks.
 *
 * Retry policy: Coach Service may be cold-starting; we set `retries: 5` and
 * let Inngest's exponential backoff do the rest.
 */
import { inngest } from '../client.js';
import { getDbAdapter } from '../db.js';
import { createCoachClientFromEnv, CoachClientError, type CoachClient } from '../coach-client.js';
import type { Api } from '@notomorrow/domain';

/**
 * Tapering K factor for the Elo update. arch/03-rating-system.md → "K decays
 * as expertise grows (32 → 16 → 8) to dampen volatility for advanced users."
 */
export const EXPERTISE_K_NOVICE = 32;
export const EXPERTISE_K_MID = 16;
export const EXPERTISE_K_ADVANCED = 8;

/** Threshold where K drops from 32 → 16. Aligns with the 1200 baseline. */
export const K_TAPER_MID_THRESHOLD = 1600;
/** Threshold where K drops from 16 → 8. */
export const K_TAPER_ADVANCED_THRESHOLD = 2000;

export function kFactorForExpertise(expertise: number): number {
  if (expertise >= K_TAPER_ADVANCED_THRESHOLD) return EXPERTISE_K_ADVANCED;
  if (expertise >= K_TAPER_MID_THRESHOLD) return EXPERTISE_K_MID;
  return EXPERTISE_K_NOVICE;
}

/** Back-compat alias — defaults to novice K. Prefer `kFactorForExpertise`. */
export const EXPERTISE_K = EXPERTISE_K_NOVICE;

/**
 * Compute an integer expertise delta for a verified proof.
 * `quality` is the Coach score (1..5); `difficulty` is the planning-time
 * estimate of the task's Elo difficulty.
 *
 * arch/03-rating-system.md → "Rating math (first cut)"
 */
export function computeExpertiseDelta(input: {
  quality: number;
  difficulty: number;
  expertise: number;
  k?: number;
}): number {
  const k = input.k ?? kFactorForExpertise(input.expertise);
  const expected = 1 / (1 + 10 ** ((input.difficulty - input.expertise) / 400));
  const actual = input.quality / 5;
  return Math.round(k * (actual - expected));
}

/** Stamina bump for shipping a proof on the day it was due. Capped weekly downstream. */
export const STAMINA_BUMP_ON_SHIP = 2;

export const verifyProof = inngest.createFunction(
  {
    id: 'verify-proof',
    name: 'Verify ProofOfWork',
    // Coach Service may be slow / cold — be patient.
    retries: 5,
    // One verification per proof, even if upstream resends.
    idempotency: 'event.data.proofId',
  },
  { event: 'proof/submitted' },
  async ({ event, step, logger }) => {
    const { proofId } = event.data;

    const proof = await step.run('lookup-proof', async () =>
      getDbAdapter().getProofForVerification(proofId),
    );

    if (!proof) {
      // Logged loudly but not retried — a missing proof is a data bug, not
      // a transient failure.
      logger.warn(`verify-proof: proof ${proofId} not found, skipping`);
      return { skipped: true as const, reason: 'proof-not-found' };
    }

    // Use NonRetriableError-ish branching by catching CoachClientError 4xx
    // outside of `step.run` so 4xx don't burn through the retry budget.
    let grade: Api.GradeProofResponse;
    try {
      grade = await step.run('grade-proof', async () =>
        getCoachClient().gradeProof({
          proofId: proof.id,
          taskId: proof.taskId,
          userId: proof.userId,
        }),
      );
    } catch (err) {
      if (err instanceof CoachClientError && err.status >= 400 && err.status < 500) {
        logger.error(`verify-proof: Coach 4xx ${err.status}; failing without retry`);
        throw err; // surface to dashboard
      }
      throw err; // retried by Inngest
    }

    if (grade.shipped) {
      const delta = computeExpertiseDelta({
        quality: grade.quality,
        difficulty: proof.difficulty,
        // We don't have current expertise here without another DB hit; pass
        // a baseline so the formula still rewards effort. `apps/web` may
        // recompute on display with the real number.
        expertise: 1200,
      });

      const ratingEvent = await step.run('write-rating-event', async () =>
        getDbAdapter().insertRatingEvent({
          userId: proof.userId,
          domain: proof.domain,
          delta: {
            stamina: STAMINA_BUMP_ON_SHIP,
            expertise: delta,
          },
          reason: `Proof verified: quality=${grade.quality}/5`,
          sourceProofId: proof.id,
        }),
      );

      return {
        outcome: 'pass' as const,
        ratingEventId: ratingEvent.id,
        delta: ratingEvent.delta,
      };
    }

    // Fail path — write a coach message with the concrete asks.
    const body = ['Not quite there yet. Revise:', ...grade.gaps.map((g) => `- ${g}`)].join('\n');
    const message = await step.run('write-coach-message', async () =>
      getDbAdapter().insertCoachMessage({
        userId: proof.userId,
        channel: 'inbox',
        tone: 'stern',
        body,
        ctaTaskId: proof.taskId,
      }),
    );

    return {
      outcome: 'fail' as const,
      coachMessageId: message.id,
      gaps: grade.gaps,
    };
  },
);

let _coachClient: CoachClient | null = null;
function getCoachClient(): CoachClient {
  if (!_coachClient) _coachClient = createCoachClientFromEnv();
  return _coachClient;
}

export function __setCoachClientForTests(client: CoachClient | null): void {
  _coachClient = client;
}
