import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Api } from '@notomorrow/domain';
import { trainingLogs } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';
import { inngest } from '@/lib/inngest';

export async function GET(req: Request) {
  try {
    const user = await requireUserOrTest();
    const url = new URL(req.url);
    const queryParsed = Api.TrainingLogHistoryQuery.safeParse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: 'invalid query', issues: queryParsed.error.issues },
        { status: 400 },
      );
    }

    const conds = [eq(trainingLogs.userId, user.id)];
    if (queryParsed.data.from) conds.push(gte(trainingLogs.date, queryParsed.data.from));
    if (queryParsed.data.to) conds.push(lte(trainingLogs.date, queryParsed.data.to));

    const rows = await db
      .select()
      .from(trainingLogs)
      .where(and(...conds))
      .orderBy(desc(trainingLogs.date));

    return NextResponse.json({ logs: rows });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = Api.CreateTrainingLogRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [log] = await db
    .insert(trainingLogs)
    .values({
      userId: user.id,
      date: parsed.data.date,
      mood: parsed.data.mood,
      hoursTrained: parsed.data.hoursTrained,
      blockers: parsed.data.blockers,
    })
    .onConflictDoUpdate({
      target: [trainingLogs.userId, trainingLogs.date],
      set: {
        mood: parsed.data.mood,
        hoursTrained: parsed.data.hoursTrained,
        blockers: parsed.data.blockers,
      },
    })
    .returning();
  if (!log) return NextResponse.json({ error: 'insert failed' }, { status: 500 });

  try {
    await inngest.send({
      name: 'training/logged',
      data: {
        trainingLogId: log.id,
        userId: user.id,
        loggedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('inngest.send training/logged failed', err);
  }

  return NextResponse.json({ log });
}
