import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CalloutTone = 'info' | 'warning' | 'danger';

const TONES: Record<CalloutTone, string> = {
  info: 'border-brand-border bg-brand-soft text-content',
  warning: 'border-warning/40 bg-warning/10 text-content',
  danger: 'border-danger/40 bg-danger-soft text-content',
};

export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-(--radius-control) border px-4 py-3 text-sm', TONES[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1', 'text-content-muted')}>{children}</div> : null}
    </div>
  );
}
