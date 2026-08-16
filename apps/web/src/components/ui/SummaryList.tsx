import type { ReactNode } from 'react';

export interface SummaryItem {
  label: string;
  value: ReactNode;
}

/** Label/value pairs — used for the comparison summary and later for plan details. */
export function SummaryList({ items }: { items: SummaryItem[] }) {
  return (
    <dl className="divide-border-subtle divide-y">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
          <dt className="text-content-muted text-sm">{item.label}</dt>
          <dd className="text-content text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
