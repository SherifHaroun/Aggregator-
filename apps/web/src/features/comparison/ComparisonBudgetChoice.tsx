import { formatNumber, type ComparisonPriceRangeDto } from '@aggregator/shared';
import { Field, IconEdit, IconSparkle, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

export type BudgetMode = 'AUTOMATIC' | 'MANUAL';

/**
 * How the annual budget gets decided.
 *
 * Two ways: let the system read it off the plans the other filters already
 * matched, or type a figure. The automatic option shows the real price range
 * it came from, so the employee can see what they are agreeing to rather than
 * trusting a number that appeared on its own.
 */
export function ComparisonBudgetChoice({
  mode,
  onModeChange,
  budget,
  onBudgetChange,
  priceRange,
  isLoadingRange,
  currency,
  error,
}: {
  mode: BudgetMode;
  onModeChange: (mode: BudgetMode) => void;
  budget: string;
  onBudgetChange: (value: string) => void;
  /** `null` until the other requirements are complete. */
  priceRange: ComparisonPriceRangeDto | null;
  isLoadingRange: boolean;
  currency: string;
  error?: string | null;
}) {
  const money = (value: number | null) =>
    value === null ? '—' : `${formatNumber(value)}${currency ? ` ${currency}` : ''}`;

  const automaticSummary = isLoadingRange
    ? 'Reading the matching plans…'
    : !priceRange
      ? 'Complete the questions above first.'
      : priceRange.count === 0
        ? 'No plans match these requirements yet.'
        : `${priceRange.count} matching ${priceRange.count === 1 ? 'plan' : 'plans'} · ${money(priceRange.lowestPrice)} – ${money(priceRange.highestPrice)}`;

  return (
    <div className="border-border-subtle bg-surface-muted/40 rounded-(--radius-card) border p-4 sm:p-5">
      <p className="text-content text-sm font-medium">Annual budget</p>
      <p className="text-content-muted mt-1 text-xs">
        Plans above the budget are left out of the recommendation.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BudgetOption
          selected={mode === 'AUTOMATIC'}
          onSelect={() => onModeChange('AUTOMATIC')}
          icon={<IconSparkle className="size-4" />}
          title="Work it out for me"
          description={automaticSummary}
          value={
            mode === 'AUTOMATIC' && priceRange?.suggestedBudget !== null && priceRange
              ? money(priceRange.suggestedBudget)
              : null
          }
        />
        <BudgetOption
          selected={mode === 'MANUAL'}
          onSelect={() => onModeChange('MANUAL')}
          icon={<IconEdit className="size-4" />}
          title="Enter an amount"
          description="Use the figure the customer gave you."
          value={mode === 'MANUAL' && budget.trim() !== '' ? money(Number(budget)) : null}
        />
      </div>

      {mode === 'MANUAL' ? (
        <div className="mt-4">
          <Field
            label={`Amount${currency ? ` (${currency})` : ''}`}
            required
            error={error ?? undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                autoFocus
                value={budget}
                onChange={(event) => onBudgetChange(event.target.value)}
                placeholder="700"
              />
            )}
          </Field>
        </div>
      ) : null}
    </div>
  );
}

/** One of the two ways to set a budget, as a selectable card. */
function BudgetOption({
  selected,
  onSelect,
  icon,
  title,
  description,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string | null;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-(--radius-control) border p-3.5 transition',
        selected
          ? 'border-brand bg-surface shadow-(--shadow-card)'
          : 'border-border-subtle bg-surface hover:border-brand-border',
      )}
    >
      <input
        type="radio"
        name="budgetMode"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-(--radius-control) transition-colors',
          selected ? 'bg-brand text-content-inverted' : 'bg-surface-muted text-content-muted',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-sm font-semibold',
            selected ? 'text-brand-strong' : 'text-content',
          )}
        >
          {title}
        </span>
        <span className="text-content-subtle mt-0.5 block text-xs leading-relaxed">
          {description}
        </span>
        {value ? (
          <span className="text-content mt-1.5 block text-sm font-bold tabular-nums">{value}</span>
        ) : null}
      </span>
    </label>
  );
}
