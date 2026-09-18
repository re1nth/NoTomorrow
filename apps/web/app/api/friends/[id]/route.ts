import { and, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { friendships } from '@notomorrow/db-sqlite';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

const PatchFriendship = z
  .object({
    action: z.enum(['accept', 'decline']),
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchFriendship.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await params;
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.id, id),
      eq(friendships.addresseeId, user.id),
      eq(friendships.status, 'pending'),
    ),
  });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (parsed.data.action === 'decline') {
    await db.delete(friendships).where(eq(friendships.id, id));
    return NextResponse.json({ id });
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: 'accepted', updatedAt: new Date().toISOString() })
    .where(eq(friendships.id, id))
    .returning();
  return NextResponse.json({ friendship: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const { id } = await params;
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.id, id),
      or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)),
    ),
    columns: { id: true },
  });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db.delete(friendships).where(eq(friendships.id, id));
  return NextResponse.json({ id });
}
