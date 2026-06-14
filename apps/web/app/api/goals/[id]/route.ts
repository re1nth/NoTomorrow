import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Api } from '@notomorrow/domain';
import { goals } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserOrTest();
    const { id } = await params;
    const row = await db.query.goals.findFirst({
      where: and(eq(goals.id, id), eq(goals.userId, user.id)),
    });
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ goal: row });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserOrTest();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = Api.UpdateGoalRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
    }
    const [updated] = await db
      .update(goals)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .returning();
    if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserOrTest();
    const { id } = await params;
    const [updated] = await db
      .update(goals)
      .set({ status: 'abandoned', updatedAt: new Date().toISOString() })
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .returning();
    if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
