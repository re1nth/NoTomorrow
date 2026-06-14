/**
 * `streak-decay` — hourly tick that decays `rating_profiles.stamina` for
 * inactive users.
 *
 * arch/03-rating-system.md → Stamina:
 *   - decay per inactive day past a grace window
 *   - floor at 800 (never humiliating)
 *
 * Implementation rounds decay to a per-hour figure so the cron stays
 * stateless: rows whose `last_updated` is older than 24h get nudged down by
 * `STAMINA_DECAY_PER_HOUR`, floored at `STAMINA_FLOOR`. Real arithmetic is
 * delegated to the DB adapter so the UPDATE happens server-side in one
 * statement (see `DbAdapter.decayStamina`).
 *
 * No LLM call — this function only touches the DB.
 */
import { inngest } from '../client.js';
import { getDbAdapter } from '../db.js';

/** Hours of inactivity before decay kicks in (the "grace window"). */
export const STAMINA_GRACE_HOURS = 24;
/** Points removed per hour of inactivity past the grace window. */
export const STAMINA_DECAY_PER_HOUR = 1;
/** Floor — `rating_profiles.stamina` never drops below this. */
export const STAMINA_FLOOR = 800;

export const streakDecay = inngest.createFunction(
  {
    id: 'streak-decay',
    name: 'Streak decay (hourly)',
    retries: 2,
  },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const inactiveSinceIso = new Date(
      Date.now() - STAMINA_GRACE_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { rowsUpdated } = await step.run('decay-stamina', async () =>
      getDbAdapter().decayStamina({
        inactiveSinceIso,
        decayPerHour: STAMINA_DECAY_PER_HOUR,
        floor: STAMINA_FLOOR,
      }),
    );

    return { rowsUpdated };
  },
);
