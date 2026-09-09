import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  return (
    <>
      <SectionTitle
        title="Discover"
        subtitle="Something new is coming here soon."
      />
      <div className="mx-auto max-w-2xl">
        <Card>
          <p className="text-sm text-charcoal-soft">
            This space is under construction.
          </p>
        </Card>
      </div>
    </>
  );
}
