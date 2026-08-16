import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-content-muted',
  brand: 'bg-brand-soft text-brand-strong',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
