import { UnauthorizedError, requireUserOrTest } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z.string().max(64).refine(isValidTimeZone, 'not a valid IANA timezone');

const patchSchema = z
  .object({
    timezone: timezoneSchema,
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

/**
 * GET /api/me — the current user's editable profile fields.
 */
export async function GET() {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, handle: true, timezone: true, email: true, image: true },
  });
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(row);
}

/**
 * PATCH /api/me — update timezone.
 */
export async function PATCH(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { timezone } = parsed.data;
  const [updated] = await db
    .update(users)
    .set({ timezone })
    .where(eq(users.id, user.id))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({
    id: updated.id,
    handle: updated.handle,
    timezone: updated.timezone,
  });
}

/**
 * DELETE /api/me — delete the current user. FK cascades wipe counters,
 * check-ins, adapter accounts, and sessions.
 */
export async function DELETE() {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const result = await db.delete(users).where(eq(users.id, user.id)).returning({ id: users.id });
  if (result.length === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ id: user.id });
}
