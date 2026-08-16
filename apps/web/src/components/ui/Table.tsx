import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './Card';

/**
 * Responsive record table.
 *
 * On desktop it renders a real <table>. Below `md` the same rows render as
 * stacked cards, each cell labelled by its column header — so a narrow screen
 * stays readable instead of scrolling sideways.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  /** Hidden on small screens when the value is secondary. */
  hideOnMobile?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  items,
  getRowKey,
  actions,
}: {
  columns: Column<T>[];
  items: T[];
  getRowKey: (item: T) => string;
  /** Rendered at the end of every row. */
  actions?: (item: T) => ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-border-subtle bg-surface-muted/60 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="text-content-muted px-5 py-3 text-xs font-semibold tracking-wide uppercase"
                >
                  {column.header}
                </th>
              ))}
              {actions ? (
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {items.map((item) => (
              <tr key={getRowKey(item)} className="hover:bg-surface-muted/40 transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-5 py-4 align-middle', column.className)}>
                    {column.render(item)}
                  </td>
                ))}
                {actions ? (
                  <td className="px-5 py-4 text-right whitespace-nowrap">{actions(item)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-border-subtle divide-y md:hidden">
        {items.map((item) => (
          <li key={getRowKey(item)} className="px-4 py-4">
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-content-subtle shrink-0 text-xs tracking-wide uppercase">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-sm">{column.render(item)}</dd>
                  </div>
                ))}
            </dl>
            {actions ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">{actions(item)}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Compact inline action button used inside table rows. */
export function RowAction({
  onClick,
  children,
  tone = 'neutral',
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-(--radius-control) px-2.5 py-1.5 text-sm font-medium transition-colors',
        tone === 'danger'
          ? 'text-danger hover:bg-danger-soft'
          : 'text-content-muted hover:text-content hover:bg-surface-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}
