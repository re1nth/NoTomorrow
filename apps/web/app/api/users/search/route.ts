import { UnauthorizedError, requireUserOrTest } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@notomorrow/db-sqlite';
import { and, asc, like, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const MAX_RESULTS = 10;

/**
 * GET /api/users/search?q=foo
 *
 * Prefix match on `handle` (which is stored lowercase), excluding the
 * caller themselves. Auth-gated so anonymous visitors can't enumerate
 * the user table.
 *
 * The query is normalized the same way handles are at write time: trimmed,
 * lowercased, then intersected with the allowed charset. SQLite LIKE on
 * ASCII with no wildcards in the user input is safe from accidental
 * matches once we've whitelisted the characters.
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

  const raw = new URL(req.url).searchParams.get('q') ?? '';
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (normalized.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = await db.query.users.findMany({
    where: and(like(users.handle, `${normalized}%`), ne(users.id, user.id)),
    columns: { id: true, handle: true },
    orderBy: asc(users.handle),
    limit: MAX_RESULTS,
  });

  return NextResponse.json({ results });
}
