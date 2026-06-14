import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { goals, milestones, roadmaps } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/goals/:id/roadmap — the latest roadmap version + flattened
 * milestone rows, ordered by `order`.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserOrTest();
    const { id } = await params;

    // Confirm the goal belongs to the caller.
    const goal = await db.query.goals.findFirst({
      where: and(eq(goals.id, id), eq(goals.userId, user.id)),
    });
    if (!goal) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const latest = await db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.goalId, id))
      .orderBy(desc(roadmaps.generatedAt))
      .limit(1);
    const roadmap = latest[0];
    if (!roadmap) return NextResponse.json({ error: 'no roadmap' }, { status: 404 });

    const ms = await db
      .select()
      .from(milestones)
      .where(eq(milestones.roadmapId, roadmap.id))
      .orderBy(milestones.order);

    return NextResponse.json({ roadmap, milestones: ms });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
