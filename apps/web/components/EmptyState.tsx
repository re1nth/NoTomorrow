import type { ReactNode } from 'react';
import { Card } from '@/lib/ui';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card tone="muted" className="text-center py-10">
      <h3 className="font-display text-2xl mb-2">{title}</h3>
      <p className="text-charcoal-soft mb-4">{body}</p>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </Card>
  );
}
