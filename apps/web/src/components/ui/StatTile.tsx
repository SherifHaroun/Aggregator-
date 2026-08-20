import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Card, cardSurface } from './Card';

/**
 * Headline number for the dashboard. Values come from the database — the tile
 * shows a dash while loading rather than inventing a placeholder figure.
 *
 * Passing `to` turns the whole tile into a link to that screen. It renders as a
 * real `<Link>`, so the entire card is the hit area, the keyboard reaches it,
 * and Enter activates it — none of which a click handler on a `<div>` gives.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  loading = false,
  to,
}: {
  label: string;
  value: number | undefined;
  icon: ReactNode;
  hint?: string;
  loading?: boolean;
  /** Where this tile leads. Omitted, the tile is static, exactly as before. */
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-content-muted text-sm font-medium">{label}</p>
        <span
          className={cn(
            'bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-(--radius-control)',
            // Deepens with the card, not on its own hover, so the whole tile
            // reads as one control.
            to && 'transition-colors duration-200 group-hover:bg-brand-border/60',
          )}
        >
          {icon}
        </span>
      </div>
      <p className="text-content mt-3 text-3xl font-bold tabular-nums">
        {loading ? <span className="text-content-subtle">—</span> : (value ?? 0)}
      </p>
      {hint ? <p className="text-content-subtle mt-1 text-xs">{hint}</p> : null}
    </>
  );

  if (!to) return <Card className="p-5">{body}</Card>;

  return (
    <Link
      to={to}
      className={cn(
        cardSurface,
        'group block cursor-pointer p-5',
        // `transition` covers transform, box-shadow and border-color together.
        'transition duration-200',
        'hover:border-brand-border hover:-translate-y-0.5 hover:shadow-(--shadow-raised)',
        // Keyboard focus gets the same affordance as the pointer, on top of the
        // application-wide focus ring.
        'focus-visible:border-brand-border focus-visible:-translate-y-0.5 focus-visible:shadow-(--shadow-raised)',
      )}
    >
      {body}
    </Link>
  );
}
