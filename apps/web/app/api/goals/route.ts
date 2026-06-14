import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Api } from '@notomorrow/domain';
import { goals, roadmaps } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';
import { inngest } from '@/lib/inngest';

/**
 * GET /api/goals — list current user's goals.
 * POST /api/goals — create a goal + an empty roadmap. SSE generation happens
 *                   on a separate endpoint (split decision in PLAN).
 */
export async function GET() {
  try {
    const user = await requireUserOrTest();
    const rows = await db.select().from(goals).where(eq(goals.userId, user.id));
    return NextResponse.json({ goals: rows });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = Api.CreateGoalRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [goalRow] = await db
    .insert(goals)
    .values({
      userId: user.id,
      title: parsed.data.title,
      motivation: parsed.data.motivation,
      horizon: parsed.data.horizon,
      targetDate: parsed.data.targetDate,
      status: 'active',
    })
    .returning();
  if (!goalRow) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  // Create the empty roadmap shell up front so the SSE streamer always has
  // a row to attach milestones to.
  await db.insert(roadmaps).values({
    goalId: goalRow.id,
    modelVersion: 'pending',
    graph: [],
  });

  // Best-effort: announce the goal creation so the daily-coach loop can pick
  // it up. Swallow failures — the user shouldn't see them block the create.
  try {
    await inngest.send({
      name: 'goal/created',
      data: {
        goalId: goalRow.id,
        userId: user.id,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('inngest.send goal/created failed', err);
  }

  return NextResponse.json(goalRow satisfies Api.CreateGoalResponse, { status: 201 });
}
