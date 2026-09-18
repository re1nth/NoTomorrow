import { and, asc, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { directMessages, friendships } from '@notomorrow/db-sqlite';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptMessage, encryptMessage } from '@/lib/message-crypto';

const SendMessage = z
  .object({
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

async function areFriends(userId: string, friendId: string): Promise<boolean> {
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'accepted'),
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
        and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId)),
      ),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const { friendId } = await params;
  if (!(await areFriends(user.id, friendId))) {
    return NextResponse.json({ error: 'not friends' }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.senderId, user.id), eq(directMessages.recipientId, friendId)),
        and(eq(directMessages.senderId, friendId), eq(directMessages.recipientId, user.id)),
      ),
    )
    .orderBy(asc(directMessages.createdAt));

  return NextResponse.json({
    messages: rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      recipientId: row.recipientId,
      text: decryptMessage(row),
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch (err) {
    return unauthorized(err);
  }

  const { friendId } = await params;
  if (!(await areFriends(user.id, friendId))) {
    return NextResponse.json({ error: 'not friends' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SendMessage.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const encrypted = encryptMessage(parsed.data.text);
  const [created] = await db
    .insert(directMessages)
    .values({
      senderId: user.id,
      recipientId: friendId,
      ...encrypted,
      createdAt: new Date().toISOString(),
    })
    .returning();
  if (!created) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      message: {
        id: created.id,
        senderId: created.senderId,
        recipientId: created.recipientId,
        text: parsed.data.text,
        createdAt: created.createdAt,
      },
    },
    { status: 201 },
  );
}
