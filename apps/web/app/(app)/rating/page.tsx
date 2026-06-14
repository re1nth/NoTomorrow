import { eq } from 'drizzle-orm';
import { Card, RatingSparkline } from '@/lib/ui';
import { ratingEvents, ratingProfiles } from '@notomorrow/db';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';

export default async function RatingPage() {
  const user = await requireUser();

  const [profiles, events] = await Promise.all([
    db.select().from(ratingProfiles).where(eq(ratingProfiles.userId, user.id)),
    db
      .select()
      .from(ratingEvents)
      .where(eq(ratingEvents.userId, user.id))
      .orderBy(ratingEvents.occurredAt)
      .limit(30),
  ]);

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="No rating yet"
        body="Take the diagnostic and submit your first proof — the rating will move."
      />
    );
  }

  // Cumulative stamina trail — the sparkline wants a simple number[].
  let running = 1200;
  const values = events.map((e) => {
    running += e.staminaDelta;
    return running;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="font-display text-4xl">Rating</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {profiles.map((p) => (
          <Card key={p.domain} tone="glove">
            <p className="text-xs uppercase tracking-wider text-charcoal-soft">
              {p.domain}
            </p>
            <p className="font-display text-3xl mt-1">
              {p.stamina} <span className="text-base text-charcoal-soft">stamina</span>
            </p>
            <p className="font-display text-3xl">
              {p.expertise}{' '}
              <span className="text-base text-charcoal-soft">expertise</span>
            </p>
          </Card>
        ))}
      </div>
      {values.length > 1 ? (
        <Card>
          <h2 className="font-display text-lg mb-2">History</h2>
          <RatingSparkline values={values} width={320} height={64} />
        </Card>
      ) : null}
    </div>
  );
}
