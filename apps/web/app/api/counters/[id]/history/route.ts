import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { counterCheckIns, counters } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/counters/:id/history — every YYYY-MM-DD the counter was checked
 * in on, all the way back to the first check-in. Scoped to the caller (the
 * counter must belong to them). No windowing — the check-in log is
 * append-only and the detail page renders the full history.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const { id } = await params;
  const owns = await db.query.counters.findFirst({
    where: and(eq(counters.id, id), eq(counters.userId, user.id)),
    columns: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const rows = await db
    .select({ day: counterCheckIns.day })
    .from(counterCheckIns)
    .where(eq(counterCheckIns.counterId, id));
  return NextResponse.json({ days: rows.map((r) => r.day) });
}
