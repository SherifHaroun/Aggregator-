import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface border-border-subtle rounded-(--radius-card) border shadow-(--shadow-card)',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Optional leading glyph, shown in a soft brand tile. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border-subtle flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-(--radius-control)">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-content text-base font-semibold">{title}</h2>
          {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border-subtle bg-surface-muted/50 flex flex-wrap items-center justify-end gap-3 rounded-b-(--radius-card) border-t px-5 py-4 sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Numbered section wrapper used by the multi-part setup screens, matching the
 * "1 Company Information / 2 Plans" rhythm of the reference design.
 */
export function StepCard({
  step,
  title,
  description,
  action,
  children,
  className,
}: {
  step: number;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="border-border-subtle flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-brand text-content-inverted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {step}
          </span>
          <div className="min-w-0">
            <h2 className="text-content text-base font-semibold">{title}</h2>
            {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
