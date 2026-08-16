import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A large, tappable selection tile — the core control of the comparison
 * screen. It is deliberately option-agnostic: it knows nothing about customer
 * types or coverage, so any configured option list can be rendered with it.
 */
export interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** Optional leading visual (icon, illustration). */
  media?: ReactNode;
  /** Optional note rendered under the description, e.g. a business rule. */
  note?: ReactNode;
  disabled?: boolean;
  name: string;
}

export function OptionCard({
  label,
  description,
  selected,
  onSelect,
  media,
  note,
  disabled = false,
  name,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2 rounded-(--radius-card) border p-5 text-left',
        'transition-all duration-150',
        selected
          ? 'border-brand-border bg-brand-soft shadow-(--shadow-card)'
          : 'border-border-subtle bg-surface hover:border-border-strong hover:shadow-(--shadow-card)',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />

      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          {media ? (
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-(--radius-control)',
                selected ? 'bg-brand text-content-inverted' : 'bg-surface-muted text-content-muted',
              )}
              aria-hidden="true"
            >
              {media}
            </span>
          ) : null}
          <span className="text-content text-base font-semibold">{label}</span>
        </span>

        <span
          className={cn(
            'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-brand bg-brand' : 'border-border-strong bg-surface',
          )}
          aria-hidden="true"
        >
          {selected ? <span className="bg-surface size-2 rounded-full" /> : null}
        </span>
      </span>

      {description ? <span className="text-content-muted text-sm">{description}</span> : null}
      {note ? <span className="text-content-subtle text-xs">{note}</span> : null}
    </label>
  );
}
