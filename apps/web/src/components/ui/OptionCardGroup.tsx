import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { OptionCard } from './OptionCard';

/** Minimal shape this group needs — matches `ConfigOption` from @aggregator/shared. */
export interface SelectableOption {
  id: string;
  label: string;
  description?: string;
}

export interface OptionCardGroupProps<TOption extends SelectableOption> {
  name: string;
  legend: string;
  hint?: ReactNode;
  options: TOption[];
  value: string | null;
  onChange: (id: TOption['id']) => void;
  /** Per-option extra note, e.g. a business rule that applies to that option. */
  renderNote?: (option: TOption) => ReactNode;
  error?: string | null;
  columns?: 2 | 3;
  className?: string;
}

export function OptionCardGroup<TOption extends SelectableOption>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  renderNote,
  error,
  columns = 3,
  className,
}: OptionCardGroupProps<TOption>) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-content text-lg font-semibold sm:text-xl">{legend}</legend>
      {hint ? <p className="text-content-muted mt-1 text-sm">{hint}</p> : null}

      <div
        className={cn(
          'mt-4 grid gap-3 sm:gap-4',
          columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {options.map((option) => (
          <OptionCard
            key={option.id}
            name={name}
            label={option.label}
            {...(option.description !== undefined ? { description: option.description } : {})}
            selected={value === option.id}
            onSelect={() => onChange(option.id)}
            {...(renderNote ? { note: renderNote(option) } : {})}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
