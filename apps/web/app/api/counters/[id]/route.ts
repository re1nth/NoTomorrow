import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { counters } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

const UpdateCounter = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

/** GET /api/counters/:id — fetch a single counter the caller owns. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const { id } = await params;
  const row = await db.query.counters.findFirst({
    where: and(eq(counters.id, id), eq(counters.userId, user.id)),
  });
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(row);
}

/** PATCH /api/counters/:id — rename a counter the caller owns. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const body = await req.json().catch(() => null);
  const parsed = UpdateCounter.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id } = await params;
  const [row] = await db
    .update(counters)
    .set({ name: parsed.data.name })
    .where(and(eq(counters.id, id), eq(counters.userId, user.id)))
    .returning();
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(row);
}

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
