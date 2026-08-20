import { cn } from '@/lib/cn';

export interface SegmentedOption {
  id: string;
  label: string;
}

/**
 * A row of equal-width choices — the pill control the comparison card uses for
 * every "pick one of these" question.
 *
 * Real radio inputs underneath, so the keyboard and screen readers treat it as
 * the single choice it is; the pills are only what that choice looks like.
 */
export function ComparisonSegmented({
  name,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  options: SegmentedOption[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string | null;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-content mb-2 block text-sm font-medium">{legend}</legend>

      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <label
              key={option.id}
              className={cn(
                'min-w-0 flex-1 cursor-pointer rounded-(--radius-control) border px-4 py-3 text-center text-sm transition',
                'basis-[calc(50%-0.375rem)] sm:basis-0',
                selected
                  ? 'border-brand bg-brand-soft text-brand-strong font-semibold'
                  : 'border-border-subtle bg-surface text-content-muted hover:border-brand-border',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span className="block truncate">{option.label}</span>
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
