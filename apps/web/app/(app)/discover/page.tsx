import { DiscoverPOC } from '@/components/DiscoverPOC';
import { SectionTitle } from '@/components/SectionTitle';

export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  return (
    <>
      <SectionTitle
        title="Discover"
        subtitle="Rotate the trackball. Frame a photo. Fade the greens."
      />
      <div className="mx-auto max-w-5xl">
        <DiscoverPOC />
      </div>
    </>
  );
}
