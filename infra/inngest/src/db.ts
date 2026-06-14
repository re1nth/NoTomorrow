/**
 * Thin DB-access wrapper for the four Inngest functions.
 *
 * `packages/db` is being built in parallel; at the moment it ships Drizzle
 * schema for `users`, `goals`, `roadmaps`, and `rating_profiles` but does
 * **not** yet export a `createDb()` client, nor schemas for
 * `coach_messages`, `rating_events`, or proposed roadmap versions.
 *
 * To keep this package moving and to keep the wire-up explicit, we declare a
 * narrow `DbAdapter` interface here listing exactly the operations our
 * functions need. `apps/web` constructs the real adapter at boot, wiring
 * each method to `@notomorrow/db` once the corresponding schema exists.
 *
 * Where the upstream schema is not yet ready, the default adapter logs a
 * TODO and no-ops — see `defaultDbAdapter()`. Replace with a real adapter
 * before deploying.
 */
import type { CoachMessage, RatingEvent, Roadmap } from '@notomorrow/domain';

/** A user the cron jobs iterate over. */
export interface CronUser {
  id: string;
  /** IANA timezone (e.g. `America/Los_Angeles`). */
  timezone: string;
}

/** A goal that may need recalibrating. */
export interface RecalibrationGoal {
  id: string;
  userId: string;
}

/** A proof we need to look up before sending it to Coach for grading. */
export interface ProofLookup {
  id: string;
  taskId: string;
  userId: string;
  /**
   * Domain label inferred from the parent goal — used when writing the
   * resulting `RatingEvent`.
   */
  domain: string;
  /** Coach-estimated difficulty at planning time, fed into the Elo update. */
  difficulty: number;
}

/** Insertable shapes — id + sentAt/occurredAt are filled by the DB adapter. */
export type NewCoachMessage = Omit<CoachMessage, 'id' | 'sentAt' | 'readAt'>;
export type NewRatingEvent = Omit<RatingEvent, 'id' | 'occurredAt'>;
export type NewProposedRoadmap = Omit<Roadmap, 'id' | 'generatedAt'>;

/**
 * The surface area `infra/inngest` needs from the persistence layer.
 *
 * Keeping it as an interface (rather than direct Drizzle calls) means:
 *   1. We can ship before `packages/db` is fully wired.
 *   2. Tests can swap in an in-memory fake.
 *   3. `apps/web` controls connection-pool ownership.
 */
export interface DbAdapter {
  /** List every user with a non-null timezone — the cron fan-out source. */
  listAllUsers(): Promise<CronUser[]>;

  /** List active goals for a single user — driven by weekly-recalibrate. */
  listActiveGoals(userId: string): Promise<RecalibrationGoal[]>;

  /** Look up a proof + its parent goal's domain. Needed by verify-proof. */
  getProofForVerification(proofId: string): Promise<ProofLookup | null>;

  /** Persist a CoachMessage row. */
  insertCoachMessage(msg: NewCoachMessage): Promise<CoachMessage>;

  /** Persist a RatingEvent row (and apply its delta to RatingProfile). */
  insertRatingEvent(evt: NewRatingEvent): Promise<RatingEvent>;

  /** Persist a *proposed* Roadmap version (not yet active). */
  insertProposedRoadmap(roadmap: NewProposedRoadmap): Promise<Roadmap>;

  /**
   * Apply the streak-decay update: for every rating_profiles row whose
   * `lastUpdated` is older than `inactiveSinceIso`, subtract `decayPerHour`
   * from `stamina`, floored at `floor`. Returns the number of rows updated.
   *
   * arch/03-rating-system.md → Stamina
   */
  decayStamina(input: {
    inactiveSinceIso: string;
    decayPerHour: number;
    floor: number;
  }): Promise<{ rowsUpdated: number }>;
}

/**
 * Default no-op adapter used when no real DB is wired. Each method logs a
 * structured TODO and returns a benign value so handlers can complete
 * without crashing during scaffolding.
 *
 * Replace before deploy by passing a real adapter to `registerFunctions()`.
 */
export function defaultDbAdapter(): DbAdapter {
  const stub = (method: string, extra?: unknown) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        at: '@notomorrow/inngest/db',
        msg: `TODO: wire DbAdapter.${method} to @notomorrow/db`,
        extra,
      }),
    );
  };

  return {
    async listAllUsers() {
      stub('listAllUsers');
      return [];
    },
    async listActiveGoals(userId) {
      stub('listActiveGoals', { userId });
      return [];
    },
    async getProofForVerification(proofId) {
      stub('getProofForVerification', { proofId });
      return null;
    },
    async insertCoachMessage(msg) {
      stub('insertCoachMessage', msg);
      const now = new Date().toISOString();
      return {
        id: '00000000-0000-4000-8000-000000000000',
        sentAt: now,
        readAt: null,
        ...msg,
      };
    },
    async insertRatingEvent(evt) {
      stub('insertRatingEvent', evt);
      return {
        id: '00000000-0000-4000-8000-000000000001',
        occurredAt: new Date().toISOString(),
        ...evt,
      };
    },
    async insertProposedRoadmap(roadmap) {
      stub('insertProposedRoadmap', roadmap);
      return {
        id: '00000000-0000-4000-8000-000000000002',
        generatedAt: new Date().toISOString(),
        ...roadmap,
      };
    },
    async decayStamina(input) {
      stub('decayStamina', input);
      return { rowsUpdated: 0 };
    },
  };
}

/**
 * Process-wide adapter slot. `apps/web` calls `setDbAdapter(real)` at boot
 * once it has constructed a Drizzle client from `@notomorrow/db`. Tests can
 * swap in fakes via the same hook.
 */
let activeAdapter: DbAdapter = defaultDbAdapter();

export function setDbAdapter(adapter: DbAdapter): void {
  activeAdapter = adapter;
}

export function getDbAdapter(): DbAdapter {
  return activeAdapter;
}
