import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
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
  icon,
  /** `plain` drops the card chrome, for use inside an existing card. */
  variant = 'card',
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: 'card' | 'plain';
  className?: string;
}) {
  const content = (
    <>
      {icon ? (
        <span className="bg-brand-soft text-brand mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl">
          {icon}
        </span>
      ) : null}
      <h2 className="text-content text-base font-semibold">{title}</h2>
      {description ? (
        <p className="text-content-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </>
  );

  if (variant === 'plain') {
    return <div className={cn('px-6 py-10 text-center', className)}>{content}</div>;
  }

  return <Card className={cn('px-6 py-14 text-center', className)}>{content}</Card>;
}
