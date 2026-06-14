/**
 * Seed script — inserts one fully linked demo user and graph.
 *
 *   user
 *    └ ratingProfile (web-frontend)
 *    └ goal
 *        └ roadmap (5-node graph)
 *            └ 5 milestones
 *                └ 4 tasks (one of each PunchType)
 *                    └ 1 verified proof of work (on the jab)
 *    └ 2 rating events (one of them references the proof)
 *    └ 1 training log
 *
 * Idempotent: every insert uses `ON CONFLICT DO NOTHING` keyed on the stable
 * seed IDs, so re-running on a populated DB is a no-op rather than a crash.
 *
 * Run with: `DATABASE_URL=… pnpm --filter @notomorrow/db seed`
 */
import { createDbWithClient } from '../client';
import {
  coachMessages,
  goals,
  milestones,
  proofsOfWork,
  ratingEvents,
  ratingProfiles,
  roadmaps,
  tasks,
  trainingLogs,
  users,
} from '../schema/index';
import {
  DEMO_DOMAIN,
  DEMO_GOAL_ID,
  DEMO_MILESTONE_IDS,
  DEMO_PROOF_ID,
  DEMO_RATING_EVENT_IDS,
  DEMO_ROADMAP_ID,
  DEMO_TASK_IDS,
  DEMO_TRAINING_LOG_ID,
  DEMO_USER_ID,
} from './ids';

export async function seed(databaseUrl: string): Promise<void> {
  const { db, client } = createDbWithClient(databaseUrl);
  try {
    console.log(`Seeding demo data for user ${DEMO_USER_ID}…`);

    // 1. User
    await db
      .insert(users)
      .values({
        id: DEMO_USER_ID,
        handle: 'demo_fighter',
        avatar: null,
        timezone: 'America/Los_Angeles',
      })
      .onConflictDoNothing({ target: users.id });

    // 2. Rating profile for the demo user
    await db
      .insert(ratingProfiles)
      .values({
        userId: DEMO_USER_ID,
        domain: DEMO_DOMAIN,
        stamina: 1200,
        expertise: 1200,
      })
      .onConflictDoNothing();

    // 3. Goal
    const targetDate = isoDateInDays(90);
    await db
      .insert(goals)
      .values({
        id: DEMO_GOAL_ID,
        userId: DEMO_USER_ID,
        title: 'Ship a polished portfolio site',
        motivation: 'Land a senior frontend role by EOY.',
        horizon: '3m',
        targetDate,
        status: 'active',
      })
      .onConflictDoNothing({ target: goals.id });

    // 4. Roadmap (the graph mirrors the milestone titles for traceability)
    const graph = DEMO_MILESTONE_IDS.map((id, i) => ({
      id,
      title: MILESTONE_DEFS[i]!.title,
      order: i,
      dependsOn: i === 0 ? [] : [DEMO_MILESTONE_IDS[i - 1]!],
    }));
    await db
      .insert(roadmaps)
      .values({
        id: DEMO_ROADMAP_ID,
        goalId: DEMO_GOAL_ID,
        modelVersion: 'claude-opus-4-7@v1',
        graph,
      })
      .onConflictDoNothing({ target: roadmaps.id });

    // 5. Milestones
    for (let i = 0; i < MILESTONE_DEFS.length; i++) {
      const def = MILESTONE_DEFS[i]!;
      await db
        .insert(milestones)
        .values({
          id: DEMO_MILESTONE_IDS[i]!,
          roadmapId: DEMO_ROADMAP_ID,
          order: i,
          title: def.title,
          deliverable: def.deliverable,
          dueDate: isoDateInDays((i + 1) * 14),
          status: i === 0 ? 'current' : 'locked',
        })
        .onConflictDoNothing({ target: milestones.id });
    }

    // 6. Tasks — one of each PunchType, all under the first milestone
    const firstMilestone = DEMO_MILESTONE_IDS[0]!;
    const taskDefs = [
      {
        id: DEMO_TASK_IDS.jab,
        title: 'Sketch homepage hero in Figma',
        type: 'jab' as const,
        estMinutes: 25,
        status: 'verified' as const,
      },
      {
        id: DEMO_TASK_IDS.hook,
        title: 'Build hero component + responsive grid',
        type: 'hook' as const,
        estMinutes: 240,
        status: 'pending' as const,
      },
      {
        id: DEMO_TASK_IDS.uppercut,
        title: 'Wire CMS + deploy preview pipeline',
        type: 'uppercut' as const,
        estMinutes: 480,
        status: 'pending' as const,
      },
      {
        id: DEMO_TASK_IDS.dempseyRoll,
        title: 'End-to-end polish + Lighthouse 95+',
        type: 'dempsey_roll' as const,
        estMinutes: 1440,
        status: 'pending' as const,
      },
    ];
    for (const def of taskDefs) {
      await db
        .insert(tasks)
        .values({
          id: def.id,
          milestoneId: firstMilestone,
          title: def.title,
          type: def.type,
          estMinutes: def.estMinutes,
          dueDate: isoDateInDays(7),
          status: def.status,
        })
        .onConflictDoNothing({ target: tasks.id });
    }

    // 7. One verified ProofOfWork on the jab task
    const now = new Date().toISOString();
    await db
      .insert(proofsOfWork)
      .values({
        id: DEMO_PROOF_ID,
        taskId: DEMO_TASK_IDS.jab,
        kind: 'repo',
        payload: {
          kind: 'repo',
          url: 'https://github.com/demo_fighter/portfolio',
          commitSha: 'a1b2c3d4e5f6',
        },
        verifiedAt: now,
        score: 4,
      })
      .onConflictDoNothing({ target: proofsOfWork.id });

    // 8. Two RatingEvents — one tied to the proof, one a recalibration nudge
    await db
      .insert(ratingEvents)
      .values([
        {
          id: DEMO_RATING_EVENT_IDS[0],
          userId: DEMO_USER_ID,
          domain: DEMO_DOMAIN,
          staminaDelta: 8,
          expertiseDelta: 12,
          reason: 'Jab landed: hero sketch verified.',
          sourceProofId: DEMO_PROOF_ID,
        },
        {
          id: DEMO_RATING_EVENT_IDS[1],
          userId: DEMO_USER_ID,
          domain: DEMO_DOMAIN,
          staminaDelta: -3,
          expertiseDelta: 0,
          reason: 'Weekly recalibrate: stamina decay (1 missed day).',
          sourceProofId: null,
        },
      ])
      .onConflictDoNothing();

    // 9. Training log
    await db
      .insert(trainingLogs)
      .values({
        id: DEMO_TRAINING_LOG_ID,
        userId: DEMO_USER_ID,
        date: isoDateInDays(0),
        mood: 4,
        hoursTrained: 2.5,
        blockers: 'CMS schema decisions',
        coachReply: 'Pick one CMS today. Decision > perfection.',
      })
      .onConflictDoNothing({ target: trainingLogs.id });

    // 10. One coach message tying the loop together (helpful for UI dev)
    await db
      .insert(coachMessages)
      .values({
        id: '00000000-0000-7000-8000-000000000081',
        userId: DEMO_USER_ID,
        channel: 'inbox',
        tone: 'hype',
        body: 'Nice jab. Hook is queued — don’t cool down.',
        ctaTaskId: DEMO_TASK_IDS.hook,
      })
      .onConflictDoNothing({ target: coachMessages.id });

    console.log('Seed complete.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

const MILESTONE_DEFS = [
  { title: 'Discovery + IA', deliverable: 'Sitemap, content audit, moodboard.' },
  { title: 'Design system', deliverable: 'Tokens, type ramp, component primitives.' },
  { title: 'Core pages', deliverable: 'Home, work, about, contact wired and styled.' },
  { title: 'Content + CMS', deliverable: 'CMS modeled, all copy + media live.' },
  { title: 'Launch + measure', deliverable: 'Deployed, analytics on, perf budget green.' },
] as const;

function isoDateInDays(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// CLI entrypoint — `pnpm seed`.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  seed(url).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
