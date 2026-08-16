import type { ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { IconCheck } from './icons';

export interface Choice {
  id: string;
  label: string;
  description?: string;
}

/**
 * Compact radio-card group.
 *
 * Used for the small, fixed business choices — customer type and geographical
 * coverage — which come from the centralized configuration in
 * `@aggregator/shared`, never from a list typed into a component.
 */
export function ChoiceGroup({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
  columns = 3,
}: {
  name: string;
  legend: string;
  hint?: ReactNode;
  options: Choice[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string | null;
  columns?: 2 | 3;
}) {
  const groupId = useId();

  return (
    <fieldset className="min-w-0">
      <legend className="text-content mb-1 text-sm font-medium">{legend}</legend>
      {hint ? <p className="text-content-subtle mb-2 text-xs">{hint}</p> : null}

      <div className={cn('mt-2 grid gap-2', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-(--radius-control) border p-3 transition-all',
                selected
                  ? 'border-brand bg-brand-soft ring-2 ring-brand/15'
                  : 'border-border-subtle bg-surface hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={`${name}-${groupId}`}
                className="sr-only"
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    selected ? 'text-brand-strong' : 'text-content',
                  )}
                >
                  {option.label}
                </span>
                {selected ? (
                  <span className="bg-brand text-content-inverted flex size-4 shrink-0 items-center justify-center rounded-full">
                    <IconCheck className="size-3" />
                  </span>
                ) : null}
              </span>
              {option.description ? (
                <span className="text-content-subtle mt-1 text-xs leading-snug">
                  {option.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
