/**
 * `@notomorrow/inngest` — barrel export.
 *
 * `apps/web` imports this module at boot and hands `functions` to
 * `inngest`'s `serve(...)` adapter at `/api/inngest`.
 */
export { inngest, createInngest, APP_ID } from './client.js';
export * as events from './events.js';

export {
  CoachClient,
  CoachClientError,
  createCoachClientFromEnv,
  DailyCoachRequest,
  GradeProofRequest,
  RecalibrateRoadmapRequest,
  RecalibrateRoadmapResponse,
} from './coach-client.js';
export type { CoachClientConfig } from './coach-client.js';

export {
  defaultDbAdapter,
  setDbAdapter,
  getDbAdapter,
} from './db.js';
export type {
  DbAdapter,
  CronUser,
  RecalibrationGoal,
  ProofLookup,
  NewCoachMessage,
  NewRatingEvent,
  NewProposedRoadmap,
} from './db.js';

export { dailyCoachFanout, dailyCoachPerUser } from './functions/daily-coach.js';
export {
  weeklyRecalibrateFanout,
  weeklyRecalibratePerUser,
} from './functions/weekly-recalibrate.js';
export { streakDecay } from './functions/streak-decay.js';
export { verifyProof, computeExpertiseDelta } from './functions/verify-proof.js';

import { dailyCoachFanout, dailyCoachPerUser } from './functions/daily-coach.js';
import {
  weeklyRecalibrateFanout,
  weeklyRecalibratePerUser,
} from './functions/weekly-recalibrate.js';
import { streakDecay } from './functions/streak-decay.js';
import { verifyProof } from './functions/verify-proof.js';

/**
 * The flat list of registered Inngest functions. Pass straight into
 * `serve({ client, functions })`.
 */
export const functions = [
  dailyCoachFanout,
  dailyCoachPerUser,
  weeklyRecalibrateFanout,
  weeklyRecalibratePerUser,
  streakDecay,
  verifyProof,
] as const;
