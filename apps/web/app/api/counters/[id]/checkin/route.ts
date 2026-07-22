import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { counterCheckIns, counters } from '@notomorrow/db-sqlite';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * POST /api/counters/:id/checkin — increment by 1, once per local day.
 *
 * "Local" is the user's timezone (users.timezone). We format today as
 * YYYY-MM-DD via en-CA (which yields ISO order) so the comparison is a
 * plain string match against the stored `last_check_in`.
 */

function todayInTz(tz: string): string {
  // en-CA renders dates as YYYY-MM-DD regardless of locale, which matches
  // the SQLite text column we persist.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string; timezone: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const { id } = await params;
  const row = await db.query.counters.findFirst({
    where: and(eq(counters.id, id), eq(counters.userId, user.id)),
  });
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const today = todayInTz(user.timezone);
  if (row.lastCheckIn === today) {
    return NextResponse.json(
      { error: 'already checked in today', counter: row },
      { status: 409 },
    );
  }
  const [updated] = await db
    .update(counters)
    .set({ count: row.count + 1, lastCheckIn: today })
    .where(eq(counters.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  // Append to the history log so the heatmap can render. The unique
  // (counter_id, day) index makes this idempotent if a retry slips past
  // the lastCheckIn guard above.
  await db
    .insert(counterCheckIns)
    .values({ counterId: id, userId: user.id, day: today })
    .onConflictDoNothing();
  return NextResponse.json(updated);
}
