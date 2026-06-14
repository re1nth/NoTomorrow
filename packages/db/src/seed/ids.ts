/**
 * Stable UUIDs used by the seed script. Downstream agents (apps/web,
 * apps/coach, infra/inngest) can hardcode these to reference the demo
 * dataset in their own tests and fixtures.
 *
 * If you change a value here you will need to re-seed and update every
 * downstream consumer.
 */

/** The single seeded demo user. */
export const DEMO_USER_ID = '00000000-0000-7000-8000-000000000001';

/** The demo user's primary goal. */
export const DEMO_GOAL_ID = '00000000-0000-7000-8000-000000000010';

/** The roadmap generated for the demo goal. */
export const DEMO_ROADMAP_ID = '00000000-0000-7000-8000-000000000020';

/** Demo milestones (5 of them). */
export const DEMO_MILESTONE_IDS = [
  '00000000-0000-7000-8000-000000000031',
  '00000000-0000-7000-8000-000000000032',
  '00000000-0000-7000-8000-000000000033',
  '00000000-0000-7000-8000-000000000034',
  '00000000-0000-7000-8000-000000000035',
] as const;

/** Demo tasks — covers all four PunchTypes. */
export const DEMO_TASK_IDS = {
  jab: '00000000-0000-7000-8000-000000000041',
  hook: '00000000-0000-7000-8000-000000000042',
  uppercut: '00000000-0000-7000-8000-000000000043',
  dempseyRoll: '00000000-0000-7000-8000-000000000044',
} as const;

/** The single verified proof of work on the jab task. */
export const DEMO_PROOF_ID = '00000000-0000-7000-8000-000000000051';

/** Demo rating events (two of them). */
export const DEMO_RATING_EVENT_IDS = [
  '00000000-0000-7000-8000-000000000061',
  '00000000-0000-7000-8000-000000000062',
] as const;

/** The demo training log entry. */
export const DEMO_TRAINING_LOG_ID = '00000000-0000-7000-8000-000000000071';

/** Domain label used across the demo dataset. */
export const DEMO_DOMAIN = 'web-frontend';
