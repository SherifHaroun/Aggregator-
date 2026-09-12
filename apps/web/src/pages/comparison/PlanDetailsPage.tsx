import {
  presentAnnualLimit,
  presentCoreBenefits,
  presentPremium,
  type ComparisonPlanResult,
} from '@aggregator/shared';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  DataState,
  IconCart,
  IconCheck,
  IconChevronRight,
  IconDownload,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  PriceBandRange,
  ProviderListLink,
  downloadPlanDocument,
  parseComparisonRequest,
  usePlanDocumentSource,
  type DocumentAges,
} from '@/features/comparison';
import { AddToCartDialog } from '@/features/customers/AddToCartDialog';
import { useComparison } from '@/features/insurance-data/insurance-data.api';

/**
 * ONE PLAN, IN FULL.
 *
 * The step after the preview: everything the plan states, laid out to be read
 * rather than scanned, and the page a customer is sent to.
 *
 * The premium here is THIS customer's premium, so the page re-runs their
 * comparison rather than being handed a figure it cannot check. That is why
 * the criteria travel in the query string — the page is a real address that
 * survives a refresh and can be sent to somebody, and the number on it is
 * always worked out from the same engine that ranked the plans.
 */
export function PlanDetailsPage() {
  const { configurationId } = useParams<{ configurationId: string }>();
  const [params] = useSearchParams();

  const request = useMemo(() => parseComparisonRequest(params), [params]);

  const comparison = useComparison(request);
  const plan =
    [...(comparison.data?.plans ?? []), ...(comparison.data?.overBudgetPlans ?? [])].find(
      (candidate) => candidate.configurationId === configurationId,
    ) ?? null;

  /**
   * The ages the premium was priced at, as the engine resolved them — the
   * customer's own, or the standard one it assumed — so the rate table can
   * pick that band out and say which it is.
   */
  const ages: DocumentAges | null = comparison.data
    ? {
        ageFrom: comparison.data.criteria.ageFrom,
        ageTo: comparison.data.criteria.ageTo,
        assumed: comparison.data.criteria.ageAssumed,
      }
    : null;

  const document = usePlanDocumentSource(configurationId ?? null, plan?.planId ?? null);
  const backToResults = `${ROUTES.comparison.results}?${params.toString()}`;

  /** Keeping the comparison for a customer, with this plan. */
  const [addingToCart, setAddingToCart] = useState(false);
  const everyPlan = [
    ...(comparison.data?.plans ?? []),
    ...(comparison.data?.overBudgetPlans ?? []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backToResults}
          className="text-content-muted hover:text-content inline-flex items-center gap-1 text-sm"
        >
          <IconChevronRight className="size-4 rotate-180" />
          Back to comparison
        </Link>
        {plan ? (
          <Button onClick={() => setAddingToCart(true)}>
            <IconCart className="size-4" />
            Add to customer cart
          </Button>
        ) : null}
      </div>

      {addingToCart && request && plan ? (
        <AddToCartDialog
          plans={everyPlan}
          criteria={request}
          defaultPlanId={plan.configurationId}
          onClose={() => setAddingToCart(false)}
        />
      ) : null}

      <DataState
        isLoading={comparison.isLoading}
        error={comparison.error}
        data={plan ? [plan] : []}
        subject="this plan"
        onRetry={() => void comparison.refetch()}
        empty={{
          title: 'That plan is not in this comparison',
          description:
            'It may have been changed since the comparison was run. Go back and compare again.',
          action: (
            <Link to={backToResults} className="text-brand-strong text-sm font-semibold">
              Back to comparison
            </Link>
          ),
        }}
      >
        {() => (plan ? <PlanBody plan={plan} document={document} ages={ages} /> : null)}
      </DataState>
    </div>
  );
}

function PlanBody({
  plan,
  document,
  ages,
}: {
  plan: ComparisonPlanResult;
  document: ReturnType<typeof usePlanDocumentSource>;
  ages: DocumentAges | null;
}) {
  const benefits = presentCoreBenefits(plan);
  // A business priced by its workforce was priced across several bands.
  const bandAges = plan.pricedEmployeeCount === null ? ages : null;

  return (
    <div className="space-y-6">
      {/* --- who, what, and the two figures ---------------------------------- */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-content-muted text-sm font-medium">{plan.companyName}</p>
              <h1 className="text-content text-3xl font-bold tracking-tight">{plan.planName}</h1>
              <p className="text-content-subtle mt-1 text-sm">
                {plan.customerTypeLabel} · {plan.geographicalCoverageLabel} · {plan.currency}
              </p>
            </div>
            <div className="text-right">
              <p className="text-content text-3xl font-bold tabular-nums">{presentPremium(plan)}</p>
              <p className="text-content-subtle text-sm">
                {plan.pricedEmployeeCount !== null
                  ? `Estimated, based on ${plan.pricedEmployeeCount} ${
                      plan.pricedEmployeeCount === 1 ? 'employee' : 'employees'
                    }`
                  : bandAges
                    ? `Annual premium at ${
                        bandAges.ageFrom === bandAges.ageTo
                          ? `age ${bandAges.ageFrom}`
                          : `ages ${bandAges.ageFrom}–${bandAges.ageTo}`
                      }${bandAges.assumed ? ' (assumed)' : ''}`
                    : 'Annual premium'}
              </p>
            </div>
          </div>

          <div className="bg-brand-soft rounded-(--radius-control) px-5 py-4">
            <p className="text-brand-strong text-xs font-bold tracking-wide uppercase">
              Annual limit
            </p>
            <p className="text-content mt-1 text-2xl font-bold tabular-nums">
              {presentAnnualLimit(plan)}
            </p>
            <p className="text-content-muted mt-1 text-sm">
              The maximum amount payable for all eligible claims within the policy year.
            </p>
          </div>
        </CardBody>
      </Card>

      {/*
        EVERY AGE THE PLAN IS SOLD AT. The figure above is the premium at one
        age; the plan is sold across many, and a customer choosing it wants
        the whole table with the band that produced that figure picked out.
      */}
      <Section title="Price by age">
        <PriceBandRange bands={document.priceBands} currency={plan.currency} ages={bandAges} />
      </Section>

      {document.description ? (
        <Section title="Plan overview">
          <h3 className="text-content mb-2 font-semibold">About this plan</h3>
          <p className="text-content-muted text-sm leading-relaxed">{document.description}</p>
        </Section>
      ) : null}

      {/* --- the six, with the share of the bill drawn ------------------------ */}
      <Section title="Core benefits & coverage">
        <ul className="space-y-4">
          {benefits.map((benefit) => (
            <li key={benefit.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-content text-sm font-medium">{benefit.name}</span>
                <span className={cnValue(benefit.stated)}>{benefit.display}</span>
              </div>
              {benefit.fraction === null ? null : (
                <div className="bg-surface-muted mt-1.5 h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-brand h-full rounded-full"
                    style={{ width: `${Math.round(benefit.fraction * 100)}%` }}
                  />
                </div>
              )}
              {benefit.limitations.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1">
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
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Plan information">
        <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {(
            [
              ['Plan type', plan.customerTypeLabel],
              ['Coverage', plan.geographicalCoverageLabel],
              ['Currency', plan.currency ?? '—'],
              ['Medical network', plan.medicalNetworkName ?? 'Not specified in plan'],
              ['Annual premium', presentPremium(plan)],
              ['Annual limit', presentAnnualLimit(plan)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-border-subtle flex justify-between border-b py-2">
              <dt className="text-content-muted text-sm">{label}</dt>
              <dd className="text-content text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3">
          <ProviderListLink plan={plan} />
        </div>
      </Section>

      {/*
        ADDITIONAL BENEFITS LIVE HERE AND ONLY HERE. They are what a plan states
        in words, present on one plan and absent from the next, so they are read
        when somebody opens a plan rather than ranked in a column.
      */}
      {document.additional.length > 0 ? (
        <Section title="Additional benefits">
          <ul className="grid gap-2 sm:grid-cols-2">
            {document.additional.map((benefit) => (
              <li
                key={benefit.name}
                className="border-border-subtle rounded-(--radius-control) border p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-content flex min-w-0 items-center gap-2 text-sm font-medium">
                    <IconCheck className="text-success size-4 shrink-0" />
                    <span className="truncate">{benefit.name}</span>
                  </span>
                  <span className="text-content-muted shrink-0 text-sm">
                    {benefit.value ?? 'Covered'}
                  </span>
                </div>
                {benefit.details.length > 0 ? (
                  <details className="mt-1.5">
                    <summary className="text-content-subtle cursor-pointer text-xs">
                      Details
                    </summary>
                    <ul className="text-content-muted mt-1 space-y-1 text-xs">
                      {benefit.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {document.waitingPeriods.length > 0 || document.conditions.length > 0 ? (
        <Section title="Waiting periods & conditions">
          <ul className="text-content-muted space-y-1.5 text-sm">
            {[...document.waitingPeriods, ...document.conditions].map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {document.exclusions.length > 0 ? (
        <Section title="Exclusions">
          <ul className="text-content-muted space-y-1.5 text-sm">
            {document.exclusions.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => downloadPlanDocument({ plan, ...document, ages: bandAges })}>
          <IconDownload className="size-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

/** A stated figure reads solid; an unstated one reads as the absence it is. */
const cnValue = (stated: boolean) =>
  stated
    ? 'text-content shrink-0 text-sm font-bold tabular-nums'
    : 'text-content-subtle shrink-0 text-sm font-medium italic';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h2 className="text-content-muted mb-3 text-xs font-bold tracking-wide uppercase">
          {title}
        </h2>
        {children}
      </CardBody>
    </Card>
  );
}
