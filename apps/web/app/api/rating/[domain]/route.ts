import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ratingEvents, ratingProfiles } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  try {
    const user = await requireUserOrTest();
    const { domain } = await params;

    const profile = await db.query.ratingProfiles.findFirst({
      where: and(eq(ratingProfiles.userId, user.id), eq(ratingProfiles.domain, domain)),
    });
    if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 404 });

    const recentEvents = await db
      .select()
      .from(ratingEvents)
      .where(and(eq(ratingEvents.userId, user.id), eq(ratingEvents.domain, domain)))
      .orderBy(desc(ratingEvents.occurredAt))
      .limit(20);

    return NextResponse.json({ profile, recentEvents });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
