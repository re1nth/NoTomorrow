import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { coachMessages } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireUserOrTest();
    const messages = await db
      .select()
      .from(coachMessages)
      .where(eq(coachMessages.userId, user.id))
      .orderBy(desc(coachMessages.sentAt))
      .limit(50);
    return NextResponse.json({ messages });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
