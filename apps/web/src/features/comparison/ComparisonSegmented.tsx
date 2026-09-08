import { cn } from '@/lib/cn';

export interface SegmentedOption {
  id: string;
  label: string;
}

/** The id the "no preference" pill answers with. Never a real option's id. */
const NONE = '__none__';

/**
 * A row of equal-width choices — the pill control the comparison card uses for
 * every "pick one of these" question.
 *
 * Real radio inputs underneath, so the keyboard and screen readers treat it as
 * the single choice it is; the pills are only what that choice looks like.
 *
 * An OPTIONAL question gets a `noneLabel`: a first pill that stands for "no
 * preference", selected whenever nothing else is. A radio cannot be un-ticked
 * by clicking it again — the browser fires nothing — so an optional question
 * needs a pill that says so, and clicking the chosen pill a second time also
 * clears it.
 */
export function ComparisonSegmented({
  name,
  legend,
  options,
  value,
  onChange,
  onClear,
  noneLabel,
  error,
}: {
  name: string;
  legend: string;
  options: SegmentedOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** Called when the answer is withdrawn. Present only on optional questions. */
  onClear?: () => void;
  /** Wording for the "no preference" pill. Shown only with `onClear`. */
  noneLabel?: string;
  error?: string | null;
}) {
  const choices: SegmentedOption[] =
    onClear && noneLabel ? [{ id: NONE, label: noneLabel }, ...options] : options;

  return (
    <fieldset className="min-w-0">
      <legend className="text-content mb-2 block text-sm font-medium">{legend}</legend>

      <div className="flex flex-wrap gap-3">
        {choices.map((option) => {
          const selected = option.id === NONE ? value === null : option.id === value;
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
                onChange={() => (option.id === NONE ? onClear?.() : onChange(option.id))}
                onClick={() => {
                  // Already chosen and optional: choosing it again withdraws it.
                  if (selected && option.id !== NONE && onClear) onClear();
                }}
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
