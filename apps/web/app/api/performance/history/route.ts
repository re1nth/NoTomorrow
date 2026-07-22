import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { perfSessions } from '@notomorrow/db-sqlite';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/performance/history?slug=depth-of-thinking — daily max scores
 * for the given test, scoped to the caller. Rolled up in-process (max
 * per day) so the desktop SQLite path stays trivial. Returns:
 *
 *   { days: [{ day: 'YYYY-MM-DD', score: number }] }
 *
 * Days without a session simply don't appear.
 */
export async function GET(req: Request): Promise<NextResponse> {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }
  const rows = await db
    .select({ day: perfSessions.day, score: perfSessions.score })
    .from(perfSessions)
    .where(and(eq(perfSessions.userId, user.id), eq(perfSessions.testSlug, slug)));
  const maxByDay = new Map<string, number>();
  for (const r of rows) {
    const cur = maxByDay.get(r.day) ?? 0;
    if (r.score > cur) maxByDay.set(r.day, r.score);
  }
  const days = Array.from(maxByDay.entries())
    .map(([day, score]) => ({ day, score }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return NextResponse.json({ days });
}
