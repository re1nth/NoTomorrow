import { and, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { counterCheckIns, counters } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/counters/:id/history — list YYYY-MM-DD strings the counter was
 * checked in on within the trailing ~53-week window the heatmap renders.
 * Scoped to the caller (the counter must belong to them).
 */

const WINDOW_DAYS = 371;

function isoDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

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
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);
  const rows = await db
    .select({ day: counterCheckIns.day })
    .from(counterCheckIns)
    .where(
      and(
        eq(counterCheckIns.counterId, id),
        gte(counterCheckIns.day, isoDay(cutoff)),
      ),
    );
  return NextResponse.json({ days: rows.map((r) => r.day) });
}
