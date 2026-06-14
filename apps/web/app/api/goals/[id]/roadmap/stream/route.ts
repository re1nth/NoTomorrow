import { and, desc, eq } from 'drizzle-orm';
import { goals, milestones, ratingProfiles, roadmaps, users } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';
import { streamRoadmap } from '@/lib/coach-client';
import { createSseStream, sseHeaders } from '@/lib/sse';

/**
 * POST /api/goals/:id/roadmap/stream
 *
 * SSE generation pass for a goal whose row was already created by POST
 * /api/goals (split decision in PLAN). Streams `goal_created`, one
 * `milestone` per stub, and a final `done` — persisting milestone rows as
 * they arrive so a page reload keeps progress.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!goal) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  }

  // Find the empty roadmap shell created on goal creation.
  const latest = await db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.goalId, goal.id))
    .orderBy(desc(roadmaps.generatedAt))
    .limit(1);
  const roadmap = latest[0];
  if (!roadmap) {
    return new Response(JSON.stringify({ error: 'no roadmap shell' }), { status: 500 });
  }

  const sse = createSseStream();

  // Look up the user's handle + current rating snapshot so Coach Service can
  // calibrate ambition vs current level (see RatingSnapshot in apps/coach).
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const profile = await db.query.ratingProfiles.findFirst({
    where: and(eq(ratingProfiles.userId, user.id), eq(ratingProfiles.domain, 'web-frontend')),
  });

  // Compute a real dueDate from Coach's dueOffsetDays relative to goal creation.
  const goalStartMs = new Date(goal.createdAt as unknown as string).getTime();
  const toIsoDate = (offsetDays: number) => {
    const d = new Date(goalStartMs + offsetDays * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  };

  // Fire-and-forget the streaming work; the response returns the stream
  // immediately.
  (async () => {
    sse.write({ type: 'goal_created', goalId: goal.id });
    let order = 0;
    try {
      for await (const evt of streamRoadmap({
        userId: user.id,
        goalId: goal.id,
        userHandle: userRow?.handle ?? 'boxer',
        goalTitle: goal.title,
        goalMotivation: goal.motivation,
        horizon: goal.horizon,
        targetDate: goal.targetDate,
        ratingSnapshot: {
          stamina: profile?.stamina ?? 1200,
          expertise: profile?.expertise ?? 1200,
        },
        domainHint: 'web-frontend',
      })) {
        if (evt.type === 'milestone') {
          const draft = evt.milestone;
          const status = order === 0 ? 'current' : 'locked';
          const [inserted] = await db
            .insert(milestones)
            .values({
              roadmapId: roadmap.id,
              order: draft.order ?? order,
              title: draft.title,
              deliverable: draft.deliverable?.description ?? '(no description)',
              dueDate: toIsoDate(draft.dueOffsetDays ?? 0),
              status,
            })
            .returning();
          if (inserted) {
            sse.write({ type: 'milestone', milestone: inserted });
            order += 1;
          }
        } else if (evt.type === 'goal_created') {
          // Coach also emits goal_created; we've already sent ours — skip.
        } else {
          sse.write(evt);
        }
      }
      sse.write({ type: 'done', roadmapId: roadmap.id });
    } catch (err) {
      sse.write({ type: 'error', message: (err as Error).message });
    } finally {
      sse.close();
    }
  })();

  return new Response(sse.stream, { headers: sseHeaders });
}
