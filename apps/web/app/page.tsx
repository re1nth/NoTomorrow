import { LandingHero } from '@/components/LandingHero';
import { getUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Auth check runs per request. Desktop (local mode) always resolves a
// user and skips straight to /counters; cloud visitors without a
// session fall through to the marketing hero.
export const dynamic = 'force-dynamic';

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export default async function HomePage() {
  const uid = await getUserId();
  if (uid) redirect('/counters');
  return <LandingHero ctaHref={isCloud ? '/login' : '/counters'} />;
}
