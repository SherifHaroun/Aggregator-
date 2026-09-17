import { cn } from '@/lib/cn';

export interface SegmentedOption {
  id: string;
  label: string;
  /**
   * Shown but not offered — a line the broker is adding next. The pill is
   * drawn greyed with a small tag, so a visitor sees it is coming rather
   * than wondering why it is missing, and cannot pick it.
   */
  disabled?: boolean;
  /** The tag on a disabled pill. "Coming soon" when not said. */
  disabledLabel?: string;
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
          const disabled = option.disabled === true;
          return (
            <label
              key={option.id}
              className={cn(
                'min-w-0 flex-1 rounded-(--radius-control) border px-4 py-3 text-center text-sm transition',
                'basis-[calc(50%-0.375rem)] sm:basis-0',
                disabled
                  ? 'border-border-subtle bg-surface-muted text-content-subtle cursor-not-allowed'
                  : selected
                    ? 'border-brand bg-brand-soft text-brand-strong cursor-pointer font-semibold'
                    : 'border-border-subtle bg-surface text-content-muted hover:border-brand-border cursor-pointer',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                disabled={disabled}
                onChange={() => (option.id === NONE ? onClear?.() : onChange(option.id))}
                onClick={() => {
                  // Already chosen and optional: choosing it again withdraws it.
                  if (selected && option.id !== NONE && onClear) onClear();
                }}
              />
              <span className="block truncate">{option.label}</span>
              {disabled ? (
                <span className="text-accent mt-1 block text-[0.65rem] font-bold tracking-[0.15em] uppercase">
                  {option.disabledLabel ?? 'Coming soon'}
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
