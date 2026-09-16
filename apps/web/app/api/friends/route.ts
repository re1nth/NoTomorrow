import { and, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { friendships, users } from '@notomorrow/db-sqlite';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeHandle } from '@/lib/handle';

const CreateFriendRequest = z
  .object({
    handle: z.string().trim().min(1).max(80),
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

function friendshipWhere(userId: string) {
  return or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId));
}

async function profile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, handle: true, image: true },
  });
}

export async function GET() {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const rows = await db
    .select()
    .from(friendships)
    .where(friendshipWhere(user.id));

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const otherId = row.requesterId === user.id ? row.addresseeId : row.requesterId;
      return {
        id: row.id,
        status: row.status,
        direction: row.requesterId === user.id ? 'outgoing' : 'incoming',
        friend: await profile(otherId),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),
  );

  return NextResponse.json({ friendships: enriched });
}

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateFriendRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const handle = normalizeHandle(parsed.data.handle);
  const target = await db.query.users.findFirst({
    where: eq(users.handle, handle),
    columns: { id: true, handle: true, image: true },
  });
  if (!target) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: 'cannot add yourself' }, { status: 400 });
  }

  const existing = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, target.id)),
      and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, user.id)),
    ),
  });
  if (existing) {
    return NextResponse.json({ error: 'friendship already exists' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const [created] = await db
    .insert(friendships)
    .values({
      requesterId: user.id,
      addresseeId: target.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ friendship: created, friend: target }, { status: 201 });
}
