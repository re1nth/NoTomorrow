import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Button, Card } from '@/lib/ui';
import { goals } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';

export default async function GoalsPage() {
  const user = await requireUser();
  const rows = await db.select().from(goals).where(eq(goals.userId, user.id));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl">Goals</h1>
        <Link href="/goals/new">
          <Button variant="primary">New goal</Button>
        </Link>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          title="No goals yet"
          body="One goal at a time. The coach prefers depth to breadth."
          action={
            <Link href="/goals/new">
              <Button>Set the first one</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`}>
              <Card interactive tone={g.status === 'active' ? 'glove' : 'default'}>
                <p className="font-display text-lg">{g.title}</p>
                <p className="text-sm text-charcoal-soft">
                  {g.status} · target {g.targetDate}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
