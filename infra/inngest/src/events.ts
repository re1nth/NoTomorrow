/**
 * Inngest event payload schemas.
 *
 * Every inbound event handled by `infra/inngest` is declared here as a Zod
 * schema + inferred TypeScript type. `apps/web` should import these to build
 * `inngest.send(...)` payloads so the contract is enforced at the boundary.
 *
 * The string event names follow `<domain>/<verb>` convention (Inngest house
 * style) — the part before the slash is the bounded context, the part after
 * is the past-tense verb.
 *
 * arch/06-coach-loop.md and arch/TRACKER.md (infra/inngest contract) drive
 * which events exist.
 */
import { z } from 'zod';
import { Id, IsoDateTime } from '@notomorrow/domain';

/**
 * Fired by `apps/web` after a user POSTs to `/tasks/:id/proof`. The
 * `verify-proof` function picks this up, calls Coach Service, and writes
 * either a RatingEvent (pass) or a CoachMessage (fail).
 *
 * arch/06-coach-loop.md → On proof submission
 */
export const ProofSubmittedEvent = z
  .object({
    name: z.literal('proof/submitted'),
    data: z
      .object({
        proofId: Id,
        taskId: Id,
        userId: Id,
        submittedAt: IsoDateTime,
      })
      .strict(),
  })
  .strict();
export type ProofSubmittedEvent = z.infer<typeof ProofSubmittedEvent>;

/**
 * Fired by `verify-proof` (and `apps/web` task completion handler) when all
 * child tasks of a milestone are verified. Drives the KO animation on the
 * client.
 */
export const MilestoneClearedEvent = z
  .object({
    name: z.literal('milestone/cleared'),
    data: z
      .object({
        milestoneId: Id,
        goalId: Id,
        userId: Id,
        clearedAt: IsoDateTime,
      })
      .strict(),
  })
  .strict();
export type MilestoneClearedEvent = z.infer<typeof MilestoneClearedEvent>;

/**
 * Fired by `apps/web` when a Goal is created. May be used to kick off
 * downstream onboarding tasks (e.g. an immediate first daily-coach message
 * instead of waiting until tomorrow morning).
 */
export const GoalCreatedEvent = z
  .object({
    name: z.literal('goal/created'),
    data: z
      .object({
        goalId: Id,
        userId: Id,
        createdAt: IsoDateTime,
      })
      .strict(),
  })
  .strict();
export type GoalCreatedEvent = z.infer<typeof GoalCreatedEvent>;

/**
 * Fired by `apps/web` when a TrainingLog row is inserted. Carried forward in
 * case any future loop wants to react synchronously (e.g. stamina credit) —
 * for now no function subscribes, but the event is part of the published
 * contract.
 */
export const TrainingLoggedEvent = z
  .object({
    name: z.literal('training/logged'),
    data: z
      .object({
        trainingLogId: Id,
        userId: Id,
        loggedAt: IsoDateTime,
      })
      .strict(),
  })
  .strict();
export type TrainingLoggedEvent = z.infer<typeof TrainingLoggedEvent>;

/**
 * Internal fan-out event for `daily-coach`. Emitted by the cron when it
 * sees a user whose local clock just struck 07:00; consumed by a per-user
 * handler.
 */
export const DailyCoachFanoutEvent = z
  .object({
    name: z.literal('coach/daily.fanout'),
    data: z
      .object({
        userId: Id,
        /** User-local date the message is for (YYYY-MM-DD). */
        localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
  })
  .strict();
export type DailyCoachFanoutEvent = z.infer<typeof DailyCoachFanoutEvent>;

/**
 * Internal fan-out event for `weekly-recalibrate`. Emitted by the Sunday
 * 20:00 cron; consumed by a per-user handler that calls Coach Service and
 * writes a proposed Roadmap version.
 */
export const WeeklyRecalibrateFanoutEvent = z
  .object({
    name: z.literal('coach/weekly.fanout'),
    data: z
      .object({
        userId: Id,
        /** ISO week the recalibration covers (YYYY-Www). */
        isoWeek: z.string().regex(/^\d{4}-W\d{2}$/),
      })
      .strict(),
  })
  .strict();
export type WeeklyRecalibrateFanoutEvent = z.infer<typeof WeeklyRecalibrateFanoutEvent>;

/**
 * Union of every event the system may dispatch. Useful for exhaustive
 * runtime parsing if `apps/web` ever needs to validate a raw payload before
 * forwarding.
 */
export const InngestEvent = z.discriminatedUnion('name', [
  ProofSubmittedEvent,
  MilestoneClearedEvent,
  GoalCreatedEvent,
  TrainingLoggedEvent,
  DailyCoachFanoutEvent,
  WeeklyRecalibrateFanoutEvent,
]);
export type InngestEvent = z.infer<typeof InngestEvent>;

/**
 * Inngest's TS SDK is typed via a record keyed by event name; we build that
 * record from the schemas above so type-narrowing inside function handlers
 * is automatic.
 */
export type Events = {
  'proof/submitted': { data: z.infer<typeof ProofSubmittedEvent>['data'] };
  'milestone/cleared': { data: z.infer<typeof MilestoneClearedEvent>['data'] };
  'goal/created': { data: z.infer<typeof GoalCreatedEvent>['data'] };
  'training/logged': { data: z.infer<typeof TrainingLoggedEvent>['data'] };
  'coach/daily.fanout': { data: z.infer<typeof DailyCoachFanoutEvent>['data'] };
  'coach/weekly.fanout': { data: z.infer<typeof WeeklyRecalibrateFanoutEvent>['data'] };
};
