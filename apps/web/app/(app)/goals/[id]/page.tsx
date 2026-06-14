import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { Card, KOStamp } from '@/lib/ui';
import { goals, milestones, roadmaps } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';
import { RegenerateRoadmap } from './RegenerateRoadmap';

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!goal) notFound();

  const latest = await db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.goalId, id))
    .orderBy(desc(roadmaps.generatedAt))
    .limit(1);

  const ms = latest[0]
    ? await db
        .select()
        .from(milestones)
        .where(eq(milestones.roadmapId, latest[0].id))
        .orderBy(milestones.order)
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-4xl">{goal.title}</h1>
        <p className="text-sm text-charcoal-soft">
          {goal.status} · target {goal.targetDate}
        </p>
      </header>

      {ms.length === 0 ? (
        <EmptyState
          title="Roadmap not generated"
          body="No milestones yet. Coach hasn't planned this round."
          action={<RegenerateRoadmap goalId={goal.id} />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ms.map((m, i) => (
            <Link
              key={m.id}
              href={`/goals/${goal.id}/milestones/${m.id}`}
            >
              <Card
                interactive
                tone={
                  m.status === 'cleared' ? 'ko' : m.status === 'current' ? 'glove' : 'default'
                }
                header={`Round ${i + 1}`}
                className="relative"
              >
                <p className="font-display text-lg">{m.title}</p>
                <p className="text-sm text-charcoal-soft mt-1">{m.deliverable}</p>
                <p className="text-xs text-charcoal-soft mt-2">Due {m.dueDate}</p>
                {m.status === 'cleared' ? (
                  <div className="absolute -top-2 -right-2">
                    <KOStamp size={64} />
                  </div>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
