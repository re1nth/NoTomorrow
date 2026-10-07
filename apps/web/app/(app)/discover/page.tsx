import { DiscoverPOC } from '@/components/DiscoverPOC';
import { ProfileSearch } from '@/components/ProfileSearch';
import { SectionTitle } from '@/components/SectionTitle';

export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  return (
    <>
      <SectionTitle
        title="Discover"
        subtitle="Rotate the trackball. Frame a photo. Fade the greens."
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <ProfileSearch />
        <DiscoverPOC />
      </div>
    </>
  );
}
