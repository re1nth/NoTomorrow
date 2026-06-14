import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Api } from '@notomorrow/domain';
import { proofsOfWork, tasks } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';
import { inngest } from '@/lib/inngest';

/**
 * POST /api/tasks/:id/proof — submit proof, enqueue verification job.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const { id: taskId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Api.SubmitProofRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });

  const [proof] = await db
    .insert(proofsOfWork)
    .values({
      taskId,
      kind: parsed.data.kind,
      payload: parsed.data.payload,
    })
    .returning();
  if (!proof) return NextResponse.json({ error: 'insert failed' }, { status: 500 });

  await db.update(tasks).set({ status: 'submitted' }).where(eq(tasks.id, taskId));

  try {
    await inngest.send({
      name: 'proof/submitted',
      data: {
        proofId: proof.id,
        taskId,
        userId: user.id,
        submittedAt: proof.submittedAt,
      },
    });
  } catch (err) {
    console.warn('inngest.send proof/submitted failed', err);
  }

  return NextResponse.json({ proof });
}
