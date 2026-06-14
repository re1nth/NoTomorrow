import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { Button, Card, CoachBubble, StreakBandage } from '@/lib/ui';
import { coachMessages, goals } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';

/**
 * Gym — the home page once signed in. Today's primary task, latest coach
 * message, streak. Fully server-rendered.
 */
export default async function GymPage() {
  const user = await requireUser();

  const [activeGoal, latestMessage] = await Promise.all([
    db.query.goals.findFirst({
      where: and(eq(goals.userId, user.id), eq(goals.status, 'active')),
    }),
    db.query.coachMessages.findFirst({
      where: eq(coachMessages.userId, user.id),
      orderBy: desc(coachMessages.sentAt),
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl">Gym</h1>
        <StreakBandage days={0} />
      </header>

      {latestMessage ? (
        <CoachBubble tone={latestMessage.tone} side="left">
          {latestMessage.body}
        </CoachBubble>
      ) : (
        <CoachBubble tone="warm" side="left">
          The bell hasn&apos;t rung yet. Create a goal to wake the coach.
        </CoachBubble>
      )}

      {activeGoal ? (
        <Card tone="glove" header="Today's round">
          <p className="text-lg mb-2">{activeGoal.title}</p>
          <p className="text-sm text-charcoal-soft mb-4">
            Target: {activeGoal.targetDate} · Horizon: {activeGoal.horizon}
          </p>
          <Link href={`/goals/${activeGoal.id}`}>
            <Button variant="primary">Enter the ring</Button>
          </Link>
        </Card>
      ) : (
        <EmptyState
          title="No active goal yet"
          body="Pick a goal so the coach can plan your week."
          action={
            <Link href="/goals/new">
              <Button variant="primary">Start a goal</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
