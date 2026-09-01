import { formatNumber, type ComparisonPlanResult } from '@aggregator/shared';
import { Link } from 'react-router-dom';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CompanyLogo,
  IconCheck,
  IconChevronRight,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

const price = (plan: { annualPrice: number | null; currency: string | null }) =>
  plan.annualPrice === null
    ? '—'
    : `${plan.currency ? `${plan.currency} ` : ''}${formatNumber(plan.annualPrice)}`;

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
}: {
  plan: ComparisonPlanResult;
  reasons: string[];
  label?: string;
  /** `warning` marks a plan that costs more than the customer asked to pay. */
  tone?: 'brand' | 'warning';
}) {
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
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo name={plan.companyName} logoUrl={plan.companyLogoUrl} />
          <div className="min-w-0 flex-1">
            <p className="text-content-muted text-sm font-medium">{plan.companyName}</p>
            <h3 className="text-content text-xl font-bold">{plan.planName}</h3>
            <p className="text-content-subtle mt-1 text-xs">
              {plan.customerTypeLabel} • {plan.geographicalCoverageLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-content text-2xl font-bold tabular-nums">{price(plan)}</p>
            <p className="text-content-subtle text-xs">per year</p>
          </div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-2">
          {plan.benefits.map((benefit) => (
            <div
              key={benefit.optionId}
              className="border-border-subtle flex items-baseline justify-between gap-3 border-b pb-1.5"
            >
              <dt className="text-content-muted min-w-0 truncate text-sm">
                {benefit.optionName}
                {/**
                 * The conditions the plan attaches to this figure. Shown under
                 * it because two plans can quote the same number and still be
                 * offering different cover.
                 *
                 * EACH ONE IS DRAWN SEPARATELY. Joined into a line, nine
                 * recorded answers about what an inpatient stay includes read
                 * as one vague remark — as if somebody had typed a sentence —
                 * and the ninth is lost to truncation. They are nine separate
                 * facts and they stay nine.
                 */}
                {benefit.limitations.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {benefit.limitations.map((limitation) => (
                      <span
                        key={limitation.id}
                        className="bg-surface-muted text-content-subtle rounded-(--radius-control) px-1.5 py-0.5 text-xs"
                      >
                        {limitation.name}
                      </span>
                    ))}
                  </span>
                ) : null}
              </dt>
              <dd
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  benefit.covered ? 'text-content' : 'text-content-subtle italic',
                )}
              >
                {benefit.display}
              </dd>
            </div>
          ))}
        </dl>

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

        <div className="flex justify-end">
          <ButtonLink to={ROUTES.plans.detail(plan.companyId, plan.planId)}>
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
      label: 'Premium',
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
    { key: 'benefits-heading', label: 'Core benefits', heading: true, cells: [] },
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

/** A non-recommended match, listed under the winner. */
export function AlternativePlanCard({ plan }: { plan: ComparisonPlanResult }) {
  return (
    <Card className={cn('p-5', plan.isDominated && 'opacity-75')}>
      <div className="flex flex-wrap items-start gap-3">
        <CompanyLogo name={plan.companyName} logoUrl={plan.companyLogoUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-content-muted text-xs">{plan.companyName}</p>
          <Link
            to={ROUTES.plans.detail(plan.companyId, plan.planId)}
            className="text-content hover:text-brand-strong font-semibold"
          >
            {plan.planName}
          </Link>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {plan.isCheapest ? <Badge tone="success">Cheapest</Badge> : null}
            {plan.isHighestCoverage ? <Badge tone="brand">Most cover</Badge> : null}
            {plan.isDominated ? <Badge tone="neutral">Outclassed</Badge> : null}
            {plan.missingBenefitCount > 0 ? (
              <Badge tone="warning">{plan.missingBenefitCount} not covered</Badge>
            ) : null}
          </p>
        </div>
        <p className="text-content shrink-0 text-lg font-bold tabular-nums">{price(plan)}</p>
      </div>
    </Card>
  );
}
