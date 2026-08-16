import type { ReactNode } from 'react';
import { Card } from './Card';

/**
 * Used wherever a screen has no data yet. Insurance data is entered by
 * employees, so empty is the normal starting state — never fill a screen with
 * placeholder records instead.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <h2 className="text-content text-base font-semibold">{title}</h2>
      {description ? (
        <p className="text-content-muted mx-auto mt-2 max-w-md text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
