import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { Card, PunchIcon } from '@/lib/ui';
import { goals, milestones, roadmaps, tasks } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { SubmitProofForm } from './SubmitProofForm';

export default async function MilestonePage({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const user = await requireUser();
  const { id: goalId, mid } = await params;

  // Confirm ownership: milestone → roadmap → goal → user.
  const ms = await db.query.milestones.findFirst({
    where: eq(milestones.id, mid),
  });
  if (!ms) notFound();
  const rm = await db.query.roadmaps.findFirst({ where: eq(roadmaps.id, ms.roadmapId) });
  if (!rm) notFound();
  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, rm.goalId), eq(goals.userId, user.id)),
  });
  if (!goal || goal.id !== goalId) notFound();

  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.milestoneId, mid));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <header>
        <p className="text-xs uppercase tracking-wider text-charcoal-soft">Round</p>
        <h1 className="font-display text-3xl">{ms.title}</h1>
        <p className="text-sm text-charcoal-soft mt-1">{ms.deliverable}</p>
      </header>

      <Card>
        <h2 className="font-display text-lg mb-3">Punches</h2>
        {taskRows.length === 0 ? (
          <p className="text-sm text-charcoal-soft">No tasks yet.</p>
        ) : (
          <ul className="space-y-4">
            {taskRows.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 pb-3 border-b border-charcoal/10 last:border-0"
              >
                <PunchIcon type={t.type} />
                <div className="flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-charcoal-soft">
                    {t.type} · ~{t.estMinutes} min · due {t.dueDate} · {t.status}
                  </p>
                  <div className="mt-2">
                    <SubmitProofForm taskId={t.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
