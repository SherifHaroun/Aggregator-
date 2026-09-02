import { formatNumber, type ComparisonPlanResult } from '@aggregator/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  IconCheck,
  IconChevronRight,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { AnnualLimitPanel, CoreBenefitList, PlanFigures, PlanIdentity } from './PlanSummary';

const price = (plan: { annualPrice: number | null; currency: string | null }) =>
  plan.annualPrice === null
    ? '—'
    : `${plan.currency ? `${plan.currency} ` : ''}${formatNumber(plan.annualPrice)}`;

/**
 * WHAT THE FIGURE IS, in the customer's terms.
 *
 * A single person's premium is the premium. A business's is every employee it
 * described priced at what the plan charges for their age — a real calculation
 * from a real rate table, but built on the workforce entered for comparison, so
 * it is an ESTIMATE and says so. Calling it the final price would be a quote,
 * and nobody here has underwritten anything.
 */
function priceCaption(plan: ComparisonPlanResult): { heading: string | null; footnote: string } {
  if (plan.pricedEmployeeCount === null) return { heading: null, footnote: 'per year' };
  return {
    heading: 'Estimated annual price',
    footnote: `Based on ${formatNumber(plan.pricedEmployeeCount)} ${
      plan.pricedEmployeeCount === 1 ? 'employee' : 'employees'
    }`,
  };
}

/**
 * The winner, with the reasons the engine produced for THAT set of plans.
 *
 * `label` names which set it won: the plans within the budget, or — shown
 * beneath them — the best of the ones above it.
 */
export function RecommendedPlanCard({
  plan,
  reasons,
  label = 'RECOMMENDED',
  tone = 'brand',
  criteria,
  onPreview,
}: {
  plan: ComparisonPlanResult;
  reasons: string[];
  label?: string;
  /** `warning` marks a plan that costs more than the customer asked to pay. */
  tone?: 'brand' | 'warning';
  /** The comparison's query string, so the full page opens on this plan. */
  criteria?: string;
  onPreview?: (plan: ComparisonPlanResult) => void;
}) {
  const fullPage = `${ROUTES.comparison.plan(plan.configurationId)}${criteria ? `?${criteria}` : ''}`;

  return (
    <Card
      className={cn(
        'shadow-(--shadow-raised) border-2',
        tone === 'brand' ? 'border-brand' : 'border-warning',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-[calc(var(--radius-card)-2px)] px-5 py-2 text-sm font-bold tracking-wide',
          // The warning token is a light amber, so it carries dark text.
          tone === 'brand' ? 'bg-brand text-content-inverted' : 'bg-warning text-content',
        )}
      >
        <span aria-hidden="true">⭐</span>
        {label}
      </div>

      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PlanIdentity plan={plan} size="lg" />
          <PlanFigures plan={plan} />
        </div>

        {/* The ceiling beside the price: two halves of one question. */}
        <AnnualLimitPanel plan={plan} />

        <div>
          <p className="text-content-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            Core benefits
          </p>
          <CoreBenefitList plan={plan} columns={2} />
        </div>

        {reasons.length > 0 ? (
          <div
            className={cn(
              'rounded-(--radius-control) px-4 py-3',
              tone === 'brand' ? 'bg-brand-soft' : 'bg-warning-soft',
            )}
          >
            <p
              className={cn(
                'text-xs font-bold tracking-wide uppercase',
                tone === 'brand' ? 'text-brand-strong' : 'text-content-muted',
              )}
            >
              Why this plan
            </p>
            <ul className="text-content mt-2 space-y-1.5 text-sm">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <IconCheck
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      tone === 'brand' ? 'text-brand' : 'text-content-muted',
                    )}
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {/* Named for its plan, so a page of them is navigable by ear. */}
          <Button
            variant="secondary"
            aria-label={`View details for ${plan.planName}`}
            onClick={() => onPreview?.(plan)}
          >
            View details
          </Button>
          <ButtonLink to={fullPage}>
            View plan
            <IconChevronRight className="size-4" />
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * The full comparison, benefit by benefit.
 *
 * WHAT IT COSTS AND HOW IT SCORES COME FIRST, because they are the two
 * questions a customer arrives with; the six core areas underneath are the
 * working that produced them. Reading the benefits first means holding six
 * rows in your head before learning the price, and the price is what decides.
 *
 * Values are never altered — the best one in each row is simply marked, so the
 * customer can see who leads without reading every number. Direction comes from
 * the engine, which is why a lower figure highlights just like a higher one
 * wherever less is better.
 */
export function ComparisonTable({
  plans,
  benefits,
}: {
  plans: ComparisonPlanResult[];
  /** The columns to compare — discovered from these plans, not chosen. */
  benefits: { id: string; name: string }[];
}) {
  if (plans.length === 0) return null;

  /** A score out of one, as the engine produced it. */
  const score = (value: number) => value.toFixed(3);

  const rows: {
    key: string;
    label: string;
    /** A heading that divides the table rather than a row of figures. */
    heading?: true;
    cells: {
      key: string;
      display: string;
      isBest: boolean;
      muted: boolean;
      /** The conditions attached to this figure, each one its own answer. */
      qualifiers?: string[];
    }[];
  }[] = [
    {
      key: 'premium',
      // Named for what it is: an SME's figure is built from its own workforce.
      label: plans.some((plan) => plan.pricedEmployeeCount !== null)
        ? 'Estimated annual price'
        : 'Premium',
      cells: plans.map((plan) => ({
        key: plan.configurationId,
        display: price(plan),
        isBest: plan.isCheapest,
        muted: plan.annualPrice === null,
      })),
    },
    {
      /**
       * The trade-off between cover and price, which is the order the plans
       * are in. Shown so the ranking is something the customer can check
       * rather than something they are asked to take on trust.
       */
      key: 'value',
      label: 'Overall value',
      cells: plans.map((plan) => ({
        key: plan.configurationId,
        display: score(plan.valueScore),
        isBest: plan.isRecommended,
        muted: false,
      })),
    },
    {
      // Cover alone, with price set aside — the dearest plan is often best here
      // and still not the one recommended.
      key: 'coverage',
      label: 'Coverage score',
      cells: plans.map((plan) => ({
        key: plan.configurationId,
        display: score(plan.coverageScore),
        isBest: plan.isHighestCoverage,
        muted: false,
      })),
    },
    // A heading with nothing under it labels an absence. Dropped when these
    // plans record no core benefit at all.
    ...(benefits.length > 0
      ? [{ key: 'benefits-heading', label: 'Core benefits', heading: true as const, cells: [] }]
      : []),
    ...benefits.map((benefit, index) => ({
      key: benefit.id,
      label: benefit.name,
      cells: plans.map((plan) => {
        const cell = plan.benefits[index]!;
        return {
          key: plan.configurationId,
          display: cell.display,
          isBest: cell.isBest,
          muted: !cell.covered,
          // Kept as a list: a table cell showing nine answers as one sentence
          // is a summary nobody wrote, and the ninth answer disappears.
          ...(cell.limitations.length > 0
            ? { qualifiers: cell.limitations.map((limitation) => limitation.name) }
            : {}),
        };
      }),
    })),
    ...(plans[0]?.attributes ?? []).map((attribute, index) => ({
      key: attribute.id,
      label: attribute.label,
      cells: plans.map((plan) => {
        const cell = plan.attributes[index]!;
        return {
          key: plan.configurationId,
          display: cell.display,
          isBest: cell.isBest,
          muted: cell.value === null,
        };
      }),
    })),
  ];

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-border-subtle bg-surface-muted/60 border-b">
              <th
                scope="col"
                className="text-content-muted px-5 py-3 text-xs font-semibold tracking-wide uppercase"
              >
                {/* The rows are a price, two scores and six benefits, so the
                    column is left blank rather than named for one of them. */}
                <span className="sr-only">What is being compared</span>
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.configurationId}
                  scope="col"
                  className={cn(
                    'px-5 py-3 text-right align-bottom',
                    plan.isRecommended && 'bg-brand-soft',
                  )}
                >
                  <span className="text-content block font-semibold">{plan.companyName}</span>
                  <span className="text-content-muted block text-xs font-normal">
                    {plan.planName}
                  </span>
                  {plan.isRecommended ? (
                    <Badge tone="brand" className="mt-1">
                      ⭐ Recommended
                    </Badge>
                  ) : plan.isDominated ? (
                    <Badge tone="neutral" className="mt-1">
                      Outclassed
                    </Badge>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {rows.map((row) =>
              row.heading ? (
                <tr key={row.key} className="bg-surface-muted/60">
                  <th
                    scope="colgroup"
                    colSpan={plans.length + 1}
                    className="text-content-muted px-5 py-2 text-xs font-semibold tracking-wide uppercase"
                  >
                    {row.label}
                  </th>
                </tr>
              ) : (
                <tr key={row.key}>
                  <th scope="row" className="text-content-muted px-5 py-3 text-sm font-medium">
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      key={cell.key}
                      className={cn(
                        'px-5 py-3 text-right tabular-nums',
                        plans[index]!.isRecommended && 'bg-brand-soft/50',
                        cell.muted && 'text-content-subtle italic',
                        cell.isBest && !cell.muted && 'text-success font-bold',
                      )}
                    >
                      {cell.display}
                      {cell.qualifiers ? (
                        <span className="mt-1 flex flex-wrap justify-end gap-1 font-normal">
                          {cell.qualifiers.map((qualifier) => (
                            <span
                              key={qualifier}
                              className="bg-surface-muted text-content-subtle rounded-(--radius-control) px-1.5 py-0.5 text-xs"
                            >
                              {qualifier}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {cell.isBest && !cell.muted ? (
                        <span className="sr-only"> (best of the matching plans)</span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * A non-recommended match.
 *
 * The SAME information as the winner, at a smaller size — company, plan,
 * premium, ceiling, six benefits. Showing less here would make the ranking
 * self-fulfilling: a customer cannot disagree with a recommendation they were
 * never given the figures to check.
 *
 * The whole card opens the preview, because that is what a customer scanning a
 * grid will click at.
 */
export function AlternativePlanCard({
  plan,
  onPreview,
}: {
  plan: ComparisonPlanResult;
  onPreview?: (plan: ComparisonPlanResult) => void;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-5 text-left transition-shadow',
        plan.isDominated && 'opacity-75',
        onPreview && 'hover:shadow-(--shadow-raised) cursor-pointer',
      )}
      {...(onPreview
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `${plan.companyName} ${plan.planName}`,
            onClick: () => onPreview(plan),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPreview(plan);
              }
            },
          }
        : {})}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PlanIdentity plan={plan} />
        <PlanFigures plan={plan} />
      </div>

      {plan.isCheapest || plan.isHighestCoverage || plan.isDominated || plan.missingBenefitCount > 0 ? (
        <p className="flex flex-wrap gap-1.5">
          {plan.isCheapest ? <Badge tone="success">Cheapest</Badge> : null}
          {plan.isHighestCoverage ? <Badge tone="brand">Most cover</Badge> : null}
          {plan.isDominated ? <Badge tone="neutral">Outclassed</Badge> : null}
          {plan.missingBenefitCount > 0 ? (
            <Badge tone="warning">{plan.missingBenefitCount} not covered</Badge>
          ) : null}
        </p>
      ) : null}

      <AnnualLimitPanel plan={plan} />
      <CoreBenefitList plan={plan} />

      {onPreview ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            aria-label={`View details for ${plan.planName}`}
            onClick={(event) => {
              event.stopPropagation();
              onPreview(plan);
            }}
          >
            View details
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
