import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ratingProfiles } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireUserOrTest();
    const rows = await db
      .select()
      .from(ratingProfiles)
      .where(eq(ratingProfiles.userId, user.id));
    return NextResponse.json({ profiles: rows });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
