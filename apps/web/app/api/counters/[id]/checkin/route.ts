import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { counterCheckIns, counters } from '@notomorrow/db-sqlite';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * POST /api/counters/:id/checkin — increment by 1.
 *
 * Body is optional: `{ "day": "YYYY-MM-DD" }` backfills a missed day
 * (must be today or earlier in the user's timezone). Absent body →
 * today. `lastCheckIn` only advances when the recorded day is newer
 * than the current value, so backfilling an old gap doesn't rewind
 * "last check-in" to a past date.
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

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  return (
    dt.getUTCFullYear() === Number(y) &&
    dt.getUTCMonth() + 1 === Number(mo) &&
    dt.getUTCDate() === Number(d)
  );
}

async function readDay(req: Request): Promise<string | null> {
  if (req.headers.get('content-length') === '0') return null;
  const text = await req.text().catch(() => '');
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { day?: unknown };
    if (parsed.day == null) return null;
    return typeof parsed.day === 'string' ? parsed.day : '';
  } catch {
    return '';
  }
}

export async function POST(
  req: Request,
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
  const requested = await readDay(req);
  const isBackfill = requested !== null;
  const day = requested ?? today;

  if (isBackfill) {
    if (!isValidYmd(day)) {
      return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });
    }
    if (day > today) {
      return NextResponse.json({ error: "can't check in for a future day" }, { status: 400 });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(counterCheckIns)
      .values({ counterId: id, userId: user.id, day })
      .onConflictDoNothing()
      .returning({ id: counterCheckIns.id });

    if (!inserted) return { status: 'duplicate' as const };

    const [updated] = await tx
      .update(counters)
      .set({
        count: sql`${counters.count} + 1`,
        lastCheckIn: sql`case when ${counters.lastCheckIn} is null or ${counters.lastCheckIn} < ${day} then ${day} else ${counters.lastCheckIn} end`,
      })
      .where(and(eq(counters.id, id), eq(counters.userId, user.id)))
      .returning();

    return { status: 'updated' as const, counter: updated };
  });

  if (result.status === 'duplicate') {
    return NextResponse.json(
      { error: isBackfill ? 'already checked in that day' : 'already checked in today', counter: row },
      { status: 409 },
    );
  }

  const updated = result.counter;
  if (!updated) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json(updated);
}
