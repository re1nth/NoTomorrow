import { ProfileForm } from '@/components/ProfileForm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@notomorrow/db-sqlite';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export default async function ProfilePage() {
  const user = await requireUser();
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, handle: true, timezone: true, email: true },
  });
  if (!row) notFound();

  // Server action for sign-out — only wired in cloud mode. Auth.js's
  // signOut clears the session cookie and revokes the session row.
  const onSignOut = isCloud
    ? async () => {
        'use server';
        const { signOut } = await import('@/lib/nextauth');
        await signOut({ redirectTo: '/' });
      }
    : null;

  return (
    <ProfileForm
      initial={{
        id: row.id,
        handle: row.handle,
        timezone: row.timezone,
        email: row.email ?? null,
      }}
      isCloud={isCloud}
      onSignOut={onSignOut}
    />
  );
}
