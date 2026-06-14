/**
 * `daily-coach` — per-user daily check-in.
 *
 * Strategy: hourly cron tick that queries all users and fans out one
 * `coach/daily.fanout` event per user whose local clock is currently 07:00.
 * A second function consumes the fan-out event, calls Coach Service, and
 * persists a `CoachMessage`.
 *
 * arch/06-coach-loop.md → Daily check-in
 * arch/TRACKER.md → infra/inngest contract
 *
 * Open question (PLAN.md): query+fan-out vs one cron per timezone. We go
 * with query+fan-out for MVP and revisit at scale.
 */
import { inngest } from '../client.js';
import { getDbAdapter } from '../db.js';
import { createCoachClientFromEnv } from '../coach-client.js';
import { localDateString, localHour } from '../timezone.js';
import type { CoachClient } from '../coach-client.js';

/**
 * The 07:00-local hour we target. Constant so tests can mirror it.
 */
export const DAILY_COACH_TARGET_HOUR = 7;

/**
 * Hourly cron — top of every UTC hour. For each user in the database, check
 * if it is currently 07:00 in their timezone; if so, emit a fan-out event.
 *
 * We don't dedupe inside this function — `coach/daily.fanout` carries a
 * `localDate` field so the downstream per-user handler can no-op on
 * duplicates (e.g. if the cron runs twice during a DST transition).
 */
export const dailyCoachFanout = inngest.createFunction(
  {
    id: 'daily-coach-fanout',
    name: 'Daily coach — hourly fan-out',
  },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const now = new Date();
    const users = await step.run('list-users', async () => getDbAdapter().listAllUsers());

    const due = users.filter((u) => localHour(now, u.timezone) === DAILY_COACH_TARGET_HOUR);

    if (due.length === 0) return { sent: 0 };

    await step.sendEvent(
      'fanout',
      due.map((u) => ({
        name: 'coach/daily.fanout' as const,
        data: {
          userId: u.id,
          localDate: localDateString(now, u.timezone),
        },
      })),
    );

    return { sent: due.length };
  },
);

/**
 * Per-user handler. Called once per `coach/daily.fanout` event.
 *
 * Builds a coach prompt by hitting Coach Service `/coach/daily`, then writes
 * the resulting message into the user's inbox.
 *
 * The Coach client is constructed lazily so importing this module doesn't
 * fail at boot when env vars aren't set (tests, build).
 */
export const dailyCoachPerUser = inngest.createFunction(
  {
    id: 'daily-coach-per-user',
    name: 'Daily coach — per-user message',
    // Idempotency: at most one message per user per local date.
    idempotency: 'event.data.userId + "-" + event.data.localDate',
    // Coach Service can be slow on cold start.
    retries: 3,
  },
  { event: 'coach/daily.fanout' },
  async ({ event, step }) => {
    const coach = getCoachClient();
    const { userId, localDate } = event.data;

    const daily = await step.run('call-coach', async () =>
      coach.daily({ userId, localDate }),
    );

    const message = await step.run('persist-message', async () =>
      getDbAdapter().insertCoachMessage({
        userId,
        channel: 'inbox',
        tone: daily.coachLine.tone,
        body: daily.coachLine.body,
        ctaTaskId: daily.primaryTask.id,
      }),
    );

    return { messageId: message.id, primaryTaskId: daily.primaryTask.id };
  },
);

/**
 * Lazy singleton so tests / scripts that import this module don't blow up
 * when `COACH_SERVICE_URL` is unset.
 */
let _coachClient: CoachClient | null = null;
function getCoachClient(): CoachClient {
  if (!_coachClient) _coachClient = createCoachClientFromEnv();
  return _coachClient;
}

/** Exposed for tests so they can inject a fake. */
export function __setCoachClientForTests(client: CoachClient | null): void {
  _coachClient = client;
}
