import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

/** Employee-facing wording for an error. Never shows a raw technical message. */
export function describeError(error: unknown, subject: string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'DATABASE_UNAVAILABLE':
        return 'The database is not available right now. Please try again in a moment.';
      case 'NOT_FOUND':
        return `We could not find the ${subject} you asked for. It may have been deleted.`;
      case 'VALIDATION_ERROR':
        return 'Some of the information provided is not valid. Please check the highlighted fields.';
      case 'INTERNAL_ERROR':
        return `Unable to load ${subject}. Please try again.`;
      default:
        // Conflicts and other business errors carry a message written for employees.
        return error.message;
    }
  }
  return `Unable to load ${subject}. Please try again.`;
}

function LoadingRows() {
  return (
    <Card className="divide-border-subtle divide-y" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4">
          <div className="bg-surface-muted h-4 w-1/3 animate-pulse rounded" />
          <div className="bg-surface-muted h-4 w-1/5 animate-pulse rounded" />
          <div className="bg-surface-muted ml-auto h-4 w-16 animate-pulse rounded" />
        </div>
      ))}
    </Card>
  );
}

/**
 * The four states every management screen must handle: loading, error, empty,
 * and content. Centralised so no page invents its own wording or layout.
 */
export function DataState<T>({
  isLoading,
  error,
  data,
  subject,
  onRetry,
  empty,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  data: T[] | undefined;
  /** Plural noun used in messages, e.g. "insurance companies". */
  subject: string;
  onRetry?: () => void;
  empty: { title: string; description?: string; action?: ReactNode };
  children: (items: T[]) => ReactNode;
}) {
  if (isLoading) return <LoadingRows />;

  if (error) {
    return (
      <Card className="px-6 py-12 text-center">
        <h2 className="text-content text-base font-semibold">Something went wrong</h2>
        <p className="text-content-muted mx-auto mt-2 max-w-md text-sm">
          {describeError(error, subject)}
        </p>
        {onRetry ? (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
        {...(empty.action ? { action: empty.action } : {})}
      />
    );
  }

  return <>{children(data)}</>;
}
