import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { counters } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * GET /api/counters — list this user's counters.
 * POST /api/counters — create a counter with an optional initial count.
 */

const CreateCounter = z
  .object({
    name: z.string().trim().min(1).max(80),
    initialCount: z.number().int().min(0).max(100_000).optional().default(0),
  })
  .strict();

function unauthorized(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  throw err;
}

export async function GET() {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const rows = await db
    .select()
    .from(counters)
    .where(eq(counters.userId, user.id))
    .orderBy(asc(counters.createdAt));
  return NextResponse.json({ counters: rows });
}

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    return unauthorized(err);
  }
  const body = await req.json().catch(() => null);
  const parsed = CreateCounter.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const [row] = await db
    .insert(counters)
    .values({
      userId: user.id,
      name: parsed.data.name,
      count: parsed.data.initialCount,
    })
    .returning();
  if (!row) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }
  return NextResponse.json(row, { status: 201 });
}
