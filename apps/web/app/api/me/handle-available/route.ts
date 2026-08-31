import { UnauthorizedError, requireUserOrTest } from '@/lib/auth';
import { db } from '@/lib/db';
import { isValidHandle, normalizeHandle } from '@/lib/handle';
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * GET /api/me/handle-available?value=foo
 *
 * Authenticated so the signed-in user's own handle reports back as `current`
 * rather than `taken` — otherwise the input would show "taken" the instant
 * the user landed on the profile page.
 *
 * Response: `{ available: boolean, reason?: 'invalid' | 'taken' | 'current' }`
 */
export async function GET(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const raw = new URL(req.url).searchParams.get('value') ?? '';
  const candidate = normalizeHandle(raw);

  if (!isValidHandle(candidate)) {
    return NextResponse.json({ available: false, reason: 'invalid' });
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.handle, candidate),
    columns: { id: true },
  });

  if (!existing) return NextResponse.json({ available: true });
  if (existing.id === user.id) return NextResponse.json({ available: true, reason: 'current' });
  return NextResponse.json({ available: false, reason: 'taken' });
}
