/**
 * Wire the real Drizzle-backed `DbAdapter` into `@notomorrow/inngest` at
 * module load. Importing this file from `app/api/inngest/route.ts` and from
 * any route that calls `inngest.send(...)` ensures the per-process slot is
 * populated exactly once.
 */
import { and, eq, lt, sql } from 'drizzle-orm';
import {
  inngest,
  functions,
  setDbAdapter,
  type CronUser,
  type DbAdapter,
  type NewCoachMessage,
  type NewProposedRoadmap,
  type NewRatingEvent,
  type ProofLookup,
  type RecalibrationGoal,
} from '@notomorrow/inngest';
import {
  coachMessages,
  goals,
  milestones,
  proofsOfWork,
  ratingEvents,
  ratingProfiles,
  roadmaps,
  tasks,
  users,
} from '@notomorrow/db';
import { db } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __notomorrowInngestWired: boolean | undefined;
}

function buildAdapter(): DbAdapter {
  return {
    async listAllUsers(): Promise<CronUser[]> {
      const rows = await db.select({ id: users.id, timezone: users.timezone }).from(users);
      return rows;
    },

    async listActiveGoals(userId: string): Promise<RecalibrationGoal[]> {
      const rows = await db
        .select({ id: goals.id, userId: goals.userId })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, 'active')));
      return rows;
    },

    async getProofForVerification(proofId: string): Promise<ProofLookup | null> {
      const row = await db
        .select({
          id: proofsOfWork.id,
          taskId: proofsOfWork.taskId,
          milestoneId: tasks.milestoneId,
          roadmapId: milestones.roadmapId,
          goalId: roadmaps.goalId,
          userId: goals.userId,
        })
        .from(proofsOfWork)
        .innerJoin(tasks, eq(tasks.id, proofsOfWork.taskId))
        .innerJoin(milestones, eq(milestones.id, tasks.milestoneId))
        .innerJoin(roadmaps, eq(roadmaps.id, milestones.roadmapId))
        .innerJoin(goals, eq(goals.id, roadmaps.goalId))
        .where(eq(proofsOfWork.id, proofId))
        .limit(1);
      const first = row[0];
      if (!first) return null;
      return {
        id: first.id,
        taskId: first.taskId,
        userId: first.userId,
        domain: 'web-frontend',
        difficulty: 1200,
      };
    },

    async insertCoachMessage(msg: NewCoachMessage) {
      const [inserted] = await db
        .insert(coachMessages)
        .values({
          userId: msg.userId,
          channel: msg.channel,
          tone: msg.tone,
          body: msg.body,
          ctaTaskId: msg.ctaTaskId,
        })
        .returning();
      if (!inserted) throw new Error('insertCoachMessage: no row returned');
      return {
        id: inserted.id,
        userId: inserted.userId,
        channel: inserted.channel,
        tone: inserted.tone,
        body: inserted.body,
        ctaTaskId: inserted.ctaTaskId,
        sentAt: inserted.sentAt,
        readAt: inserted.readAt,
      };
    },

    async insertRatingEvent(evt: NewRatingEvent) {
      const [inserted] = await db
        .insert(ratingEvents)
        .values({
          userId: evt.userId,
          domain: evt.domain,
          staminaDelta: evt.delta.stamina,
          expertiseDelta: evt.delta.expertise,
          reason: evt.reason,
          sourceProofId: evt.sourceProofId,
        })
        .returning();
      if (!inserted) throw new Error('insertRatingEvent: no row returned');

      // Apply the delta to the per-domain RatingProfile. Insert-on-conflict
      // so the first event in a domain bootstraps the row.
      await db
        .insert(ratingProfiles)
        .values({
          userId: evt.userId,
          domain: evt.domain,
          stamina: 1200 + evt.delta.stamina,
          expertise: 1200 + evt.delta.expertise,
        })
        .onConflictDoUpdate({
          target: [ratingProfiles.userId, ratingProfiles.domain],
          set: {
            stamina: sql`${ratingProfiles.stamina} + ${evt.delta.stamina}`,
            expertise: sql`${ratingProfiles.expertise} + ${evt.delta.expertise}`,
            lastUpdated: sql`now()`,
          },
        });

      return {
        id: inserted.id,
        userId: inserted.userId,
        domain: inserted.domain,
        delta: { stamina: inserted.staminaDelta, expertise: inserted.expertiseDelta },
        reason: inserted.reason,
        sourceProofId: inserted.sourceProofId,
        occurredAt: inserted.occurredAt,
      };
    },

    async insertProposedRoadmap(roadmap: NewProposedRoadmap) {
      const [inserted] = await db
        .insert(roadmaps)
        .values({
          goalId: roadmap.goalId,
          modelVersion: roadmap.modelVersion,
          graph: roadmap.graph,
        })
        .returning();
      if (!inserted) throw new Error('insertProposedRoadmap: no row returned');
      return {
        id: inserted.id,
        goalId: inserted.goalId,
        generatedAt: inserted.generatedAt,
        modelVersion: inserted.modelVersion,
        graph: inserted.graph,
      };
    },

    async decayStamina(input) {
      const result = await db
        .update(ratingProfiles)
        .set({
          stamina: sql`GREATEST(${input.floor}, ${ratingProfiles.stamina} - ${input.decayPerHour})`,
        })
        .where(lt(ratingProfiles.lastUpdated, input.inactiveSinceIso));
      return { rowsUpdated: (result as { count?: number }).count ?? 0 };
    },
  };
}

if (!global.__notomorrowInngestWired) {
  setDbAdapter(buildAdapter());
  global.__notomorrowInngestWired = true;
}

export { inngest, functions };
