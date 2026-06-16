import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { counters } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/** DELETE /api/counters/:id — remove a counter the caller owns. */
export async function DELETE(
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
  const result = await db
    .delete(counters)
    .where(and(eq(counters.id, id), eq(counters.userId, user.id)))
    .returning({ id: counters.id });
  if (result.length === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ id });
}
