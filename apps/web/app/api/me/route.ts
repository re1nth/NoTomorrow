import { UnauthorizedError, requireUserOrTest } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleSchema, normalizeHandle } from '@/lib/handle';
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
    timezone: timezoneSchema.optional(),
    handle: handleSchema.optional(),
  })
  .strict()
  .refine((v) => v.timezone !== undefined || v.handle !== undefined, {
    message: 'nothing to update',
  });

// better-sqlite3 surfaces unique-index violations as SqliteError with this
// code. Used to translate a losing race on handle updates into a clean 409.
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

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
 * PATCH /api/me — update timezone and/or handle.
 *
 * Handle updates go through a pre-check for the common case ("someone else
 * has this handle") plus a try/catch on SQLITE_CONSTRAINT_UNIQUE so a lost
 * race with a concurrent update still returns a clean 409 instead of a
 * 500.
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

  const setValues: { timezone?: string; handle?: string } = {};
  if (parsed.data.timezone !== undefined) setValues.timezone = parsed.data.timezone;
  if (parsed.data.handle !== undefined) {
    const nextHandle = normalizeHandle(parsed.data.handle);
    const taken = await db.query.users.findFirst({
      where: eq(users.handle, nextHandle),
      columns: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: 'handle taken' }, { status: 409 });
    }
    setValues.handle = nextHandle;
  }

  let updated: { id: string; handle: string; timezone: string } | undefined;
  try {
    [updated] = await db
      .update(users)
      .set(setValues)
      .where(eq(users.id, user.id))
      .returning();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: 'handle taken' }, { status: 409 });
    }
    throw err;
  }
  if (!updated) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({
    id: updated.id,
    handle: updated.handle,
    timezone: updated.timezone,
  });
}

// Auth.js v5 cookie names. The __Secure- / __Host- prefixed variants are
// what the browser stores in production (HTTPS); the unprefixed names are
// used in dev. We clear both so the same code path works in either.
// __Host- has stricter requirements (path must be '/', no Domain) which
// are already satisfied by how Auth.js sets them.
const AUTH_COOKIES: { name: string; secure: boolean }[] = [
  { name: '__Secure-authjs.session-token', secure: true },
  { name: 'authjs.session-token', secure: false },
  { name: '__Secure-authjs.callback-url', secure: true },
  { name: 'authjs.callback-url', secure: false },
  { name: '__Host-authjs.csrf-token', secure: true },
  { name: 'authjs.csrf-token', secure: false },
];

/**
 * DELETE /api/me — delete the current user.
 *
 * FK cascades wipe counters, check-ins, and any adapter rows (accounts,
 * sessions) that exist. Session strategy here is JWT, so there is no
 * session row to cascade — the browser still holds a signed cookie that
 * decodes to the just-deleted uid. Left alone, that stale cookie makes
 * `/` see the visitor as authenticated and bounce them to `/counters`,
 * where every API call 401s. Clearing the Auth.js cookies here means the
 * client's follow-up navigation to `/` hits the landing page cleanly.
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
  const response = NextResponse.json({ id: user.id });
  for (const { name, secure } of AUTH_COOKIES) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
  return response;
}
