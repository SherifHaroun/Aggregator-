import {
  presentAnnualLimit,
  presentCoreBenefits,
  presentPremium,
  type ComparisonPlanResult,
} from '@aggregator/shared';
import { CompanyLogo } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * WHAT A PLAN SAYS, WHEREVER IT IS SHOWN.
 *
 * The recommended plan, the cards beneath it and the preview that opens over
 * them are the same plan read at three sizes — so they share these parts
 * rather than three near-copies that drift until one of them is wrong.
 *
 * The order never changes: who sells it, what it costs, what it pays out to,
 * then the six core areas. A customer scanning a column of cards is comparing
 * position as much as text.
 */

export function PlanIdentity({
  plan,
  size = 'md',
}: {
  plan: ComparisonPlanResult;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <CompanyLogo
        name={plan.companyName}
        logoUrl={plan.companyLogoUrl}
        size={size === 'lg' ? 'md' : 'sm'}
      />
      <div className="min-w-0">
        <p className="text-content-muted truncate text-xs font-medium">{plan.companyName}</p>
        <h3
          className={cn(
            'text-content truncate font-bold',
            size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm',
          )}
        >
          {plan.planName}
        </h3>
        <p className="text-content-subtle mt-0.5 truncate text-xs">
          {plan.customerTypeLabel} · {plan.geographicalCoverageLabel}
        </p>
      </div>
    </div>
  );
}

/**
 * The premium, and what the plan will pay out to.
 *
 * The ceiling sits beside the price on purpose: they are the two halves of the
 * same question, and a card showing only the price invites a customer to read
 * the cheapest as the best.
 */
export function PlanFigures({
  plan,
  align = 'right',
}: {
  plan: ComparisonPlanResult;
  align?: 'left' | 'right';
}) {
  const perYear = plan.pricedEmployeeCount === null;
  return (
    <div className={cn('shrink-0', align === 'right' ? 'text-right' : 'text-left')}>
      {perYear ? null : (
        <p className="text-content-muted text-xs font-medium">Estimated annual price</p>
      )}
      <p className="text-content text-2xl font-bold tabular-nums">{presentPremium(plan)}</p>
      <p className="text-content-subtle text-xs">
        {perYear
          ? 'per year'
          : `Based on ${plan.pricedEmployeeCount} ${plan.pricedEmployeeCount === 1 ? 'employee' : 'employees'}`}
      </p>
    </div>
  );
}

/** The ceiling, in a box of its own so it is never mistaken for the premium. */
export function AnnualLimitPanel({
  plan,
  explain = false,
}: {
  plan: ComparisonPlanResult;
  explain?: boolean;
}) {
  return (
    <div className="border-border-subtle bg-surface-muted/60 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-(--radius-control) border px-4 py-3">
      <span className="text-content-muted text-xs font-semibold tracking-wide uppercase">
        Annual limit
      </span>
      <span className="text-content text-lg font-bold tabular-nums">
        {presentAnnualLimit(plan)}
      </span>
      {explain ? (
        <p className="text-content-subtle w-full text-xs">
          The maximum payable for all eligible claims within the policy year.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The six core areas, always six and always in this order.
 *
 * An area the plan never mentioned still gets a row saying so — dropping it
 * would read as an area that does not exist, when it means nobody wrote a
 * figure down.
 */
export function CoreBenefitList({
  plan,
  columns = 1,
  bars = false,
}: {
  plan: ComparisonPlanResult;
  columns?: 1 | 2;
  /** Draw the share of the bill a percentage represents. */
  bars?: boolean;
}) {
  const benefits = presentCoreBenefits(plan);

  return (
    <dl className={cn('grid gap-x-6', columns === 2 ? 'sm:grid-cols-2' : '')}>
      {benefits.map((benefit) => (
        <div
          key={benefit.name}
          className="border-border-subtle flex flex-col gap-1 border-b py-2 last:border-b-0"
        >
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-content-muted min-w-0 truncate text-sm">{benefit.name}</dt>
            <dd
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                benefit.stated ? 'text-content' : 'text-content-subtle italic',
              )}
            >
              {benefit.display}
            </dd>
          </div>

          {bars && benefit.fraction !== null ? (
            <div className="bg-surface-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${Math.round(benefit.fraction * 100)}%` }}
              />
            </div>
          ) : null}

          {benefit.limitations.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {benefit.limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="bg-surface-muted text-content-subtle rounded-(--radius-control) px-1.5 py-0.5 text-xs"
                >
                  {limitation}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
