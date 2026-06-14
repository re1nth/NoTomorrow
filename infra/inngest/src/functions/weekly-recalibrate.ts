/**
 * `weekly-recalibrate` — Sunday 20:00 user-local fan-out + per-user handler.
 *
 * For each active goal per user, ask Coach Service to propose a roadmap
 * diff. We persist the proposed roadmap as a *new* (non-active) version so
 * the user can later accept, reject, or edit it from the UI. We never
 * auto-apply.
 *
 * arch/06-coach-loop.md → Weekly recalibration
 */
import { inngest } from '../client.js';
import { getDbAdapter } from '../db.js';
import { createCoachClientFromEnv, type CoachClient } from '../coach-client.js';
import { isoWeek, localHour, localWeekday } from '../timezone.js';

export const WEEKLY_RECALIBRATE_HOUR = 20;
export const SUNDAY = 0;

/**
 * Hourly cron that emits one `coach/weekly.fanout` event per user whose
 * local Sunday is currently 20:00. Same query+fan-out pattern as daily.
 */
export const weeklyRecalibrateFanout = inngest.createFunction(
  {
    id: 'weekly-recalibrate-fanout',
    name: 'Weekly recalibrate — hourly fan-out',
  },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const now = new Date();
    const users = await step.run('list-users', async () => getDbAdapter().listAllUsers());

    const due = users.filter(
      (u) =>
        localWeekday(now, u.timezone) === SUNDAY &&
        localHour(now, u.timezone) === WEEKLY_RECALIBRATE_HOUR,
    );

    if (due.length === 0) return { sent: 0 };

    const week = isoWeek(now);
    await step.sendEvent(
      'fanout',
      due.map((u) => ({
        name: 'coach/weekly.fanout' as const,
        data: { userId: u.id, isoWeek: week },
      })),
    );

    return { sent: due.length };
  },
);

/**
 * Per-user handler. For each active goal, request a recalibration and
 * persist the proposed roadmap version.
 */
export const weeklyRecalibratePerUser = inngest.createFunction(
  {
    id: 'weekly-recalibrate-per-user',
    name: 'Weekly recalibrate — per-user',
    idempotency: 'event.data.userId + "-" + event.data.isoWeek',
    retries: 3,
  },
  { event: 'coach/weekly.fanout' },
  async ({ event, step }) => {
    const coach = getCoachClient();
    const { userId, isoWeek: week } = event.data;

    const goals = await step.run('list-active-goals', async () =>
      getDbAdapter().listActiveGoals(userId),
    );

    if (goals.length === 0) return { proposed: 0 };

    const proposedIds: string[] = [];
    for (const goal of goals) {
      const proposed = await step.run(`recalibrate-${goal.id}`, async () =>
        coach.recalibrateRoadmap({ userId, goalId: goal.id, isoWeek: week }),
      );

      const persisted = await step.run(`persist-${goal.id}`, async () =>
        getDbAdapter().insertProposedRoadmap({
          goalId: proposed.proposedRoadmap.goalId,
          modelVersion: proposed.proposedRoadmap.modelVersion,
          graph: proposed.proposedRoadmap.graph,
        }),
      );
      proposedIds.push(persisted.id);
    }

    return { proposed: proposedIds.length, roadmapIds: proposedIds };
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
