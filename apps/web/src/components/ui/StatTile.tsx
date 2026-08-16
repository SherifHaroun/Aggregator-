import type { ReactNode } from 'react';
import { Card } from './Card';

/**
 * Headline number for the dashboard. Values come from the database — the tile
 * shows a dash while loading rather than inventing a placeholder figure.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  loading = false,
}: {
  label: string;
  value: number | undefined;
  icon: ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-content-muted text-sm font-medium">{label}</p>
        <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-(--radius-control)">
          {icon}
        </span>
      </div>
      <p className="text-content mt-3 text-3xl font-bold tabular-nums">
        {loading ? <span className="text-content-subtle">—</span> : (value ?? 0)}
      </p>
      {hint ? <p className="text-content-subtle mt-1 text-xs">{hint}</p> : null}
    </Card>
  );
}
