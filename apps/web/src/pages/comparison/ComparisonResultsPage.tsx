import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatNumber } from '@aggregator/shared';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  DataState,
  EmptyState,
  IconChevronRight,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  AlternativePlanCard,
  ComparisonTable,
  PlanPreviewDialog,
  RecommendedPlanCard,
  parseComparisonRequest,
} from '@/features/comparison';
import { useComparison } from '@/features/insurance-data/insurance-data.api';

/**
 * The comparison results.
 *
 * The selection lives in the URL, so a result can be shared and survives a
 * refresh. Everything shown — which plans matched, how they score and which is
 * recommended — is computed by the API's comparison engine; this screen only
 * renders the answer, including which requirements the engine had to assume
 * because the customer left them blank.
 */
export function ComparisonResultsPage() {
  const [params] = useSearchParams();

  /**
   * The request, or `null` when the URL does not say who is being insured —
   * the one thing a comparison cannot do without.
   */
  const request = useMemo(() => parseComparisonRequest(params), [params]);

  const comparison = useComparison(request);

  if (request === null) {
    return (
      <>
        <PageHeader title="Comparison results" />
        <EmptyState
          title="Nothing selected"
          description="Choose who you want to insure. Everything else can be left to us."
          action={<ButtonLink to={ROUTES.comparison.new}>Back to selection</ButtonLink>}
        />
      </>
    );
  }

  const result = comparison.data;
  const recommended = result?.plans.find((plan) => plan.isRecommended);
  const alternatives = result?.plans.filter((plan) => !plan.isRecommended) ?? [];

  /** Which single requirement, if any, is standing between the customer and a result. */
  const blockers = result?.blockers ?? [];

  /**
   * The plan being read, if any. Held here rather than in each card so only
   * one can be open, and so closing it returns the customer to exactly the
   * results they were scanning.
   */
  const [previewing, setPreviewing] = useState<string | null>(null);
  const everyPlan = [...(result?.plans ?? []), ...(result?.overBudgetPlans ?? [])];
  const previewed = everyPlan.find((plan) => plan.configurationId === previewing) ?? null;
  const criteria = params.toString();

  /**
   * The ages the premiums were priced at — the customer's, or the standard
   * assumption — handed to the preview so its rate table can pick the band
   * out and its PDF can say which age the figure is for.
   */
  const ages = result
    ? {
        ageFrom: result.criteria.ageFrom,
        ageTo: result.criteria.ageTo,
        assumed: result.criteria.ageAssumed,
      }
    : null;

  const overBudget = result?.overBudgetPlans ?? [];
  const overBudgetPick = overBudget.find((plan) => plan.isRecommended);
  const overBudgetRest = overBudget.filter((plan) => !plan.isRecommended);

  /**
   * What the engine assumed on the customer's behalf, said once and plainly.
   * An assumption that is not named reads as something the customer chose.
   */
  const assumptions = result
    ? [
        ...(result.criteria.ageAssumed ? [`age ${result.criteria.ageFrom}`] : []),
        ...(result.criteria.currencyAssumed && result.criteria.currency
          ? [`${result.criteria.currency}, the currency most plans use`]
          : []),
        ...(result.criteria.geographicalCoverageId === null ? ['every coverage area'] : []),
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Comparison results"
        description={
          result
            ? `${result.matchedCount} matching ${result.matchedCount === 1 ? 'plan' : 'plans'}${result.criteria.planTierLabel ? ` in ${result.criteria.planTierLabel}` : ''}.`
            : 'Comparing the plans that match your requirements.'
        }
        breadcrumbs={[{ label: 'New comparison', to: ROUTES.comparison.new }, { label: 'Results' }]}
        actions={
          <ButtonLink variant="secondary" to={ROUTES.comparison.new}>
            Change selection
            <IconChevronRight className="size-4" />
          </ButtonLink>
        }
      />

      {result ? (
        <Card className="mb-5">
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {result.criteria.planTierLabel ? (
                <Badge tone="brand">{result.criteria.planTierLabel}</Badge>
              ) : null}
              <Badge>{result.criteria.customerTypeLabel}</Badge>
              <Badge>{result.criteria.geographicalCoverageLabel}</Badge>
              {result.criteria.currency ? (
                <Badge>
                  {result.criteria.currency}
                  {result.criteria.currencyAssumed ? ' (assumed)' : ''}
                </Badge>
              ) : null}
              {/*
                A business is described by its workforce, not by an age. The
                standard comparison age still decides which plans are sold to
                them, but it is the system's assumption rather than anything the
                employer said, so it is not reported back to them as a criterion.
              */}
              <Badge>
                {result.criteria.smeEmployeeCount !== null
                  ? `${formatNumber(result.criteria.smeEmployeeCount)} ${
                      result.criteria.smeEmployeeCount === 1 ? 'employee' : 'employees'
                    }`
                  : `${
                      result.criteria.ageFrom === result.criteria.ageTo
                        ? `Age ${result.criteria.ageFrom}`
                        : `Ages ${result.criteria.ageFrom}–${result.criteria.ageTo}`
                    }${result.criteria.ageAssumed ? ' (assumed)' : ''}`}
              </Badge>
              <Badge>
                {result.criteria.budget === null
                  ? 'No budget limit'
                  : `Budget ${formatNumber(result.criteria.budget)}${
                      result.criteria.currency ? ` ${result.criteria.currency}` : ''
                    }`}
              </Badge>
              <span className="text-content-subtle ml-auto text-xs">
                {result.criteria.benefits.length === 0
                  ? 'No benefits recorded on the matching plans'
                  : `Benefits found: ${result.criteria.benefits.map((benefit) => benefit.name).join(', ')}`}
              </span>
            </div>
            {assumptions.length > 0 ? (
              <p className="text-content-muted text-xs">
                Worked out for you: {assumptions.join(' · ')}. Change the selection to set them
                yourself.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <DataState
        isLoading={comparison.isLoading}
        error={comparison.error}
        data={result?.plans}
        subject="the comparison"
        onRetry={() => void comparison.refetch()}
        empty={{
          /**
           * NAME THE REQUIREMENT, never "widen the selection".
           *
           * Six things were selected. Asking the customer to loosen all of
           * them is asking them to guess, and the engine already knows which
           * one is responsible — it re-ran the query without each in turn.
           */
          title:
            (result?.overBudgetCount ?? 0) > 0
              ? 'No plans found within your budget'
              : blockers.length > 0
                ? `${blockers[0]!.label} is what rules every plan out`
                : 'No plan matches those requirements',
          description:
            (result?.overBudgetCount ?? 0) > 0
              ? `${result?.overBudgetCount} plan${result?.overBudgetCount === 1 ? '' : 's'} match everything else but cost more than your budget. They are listed below, or you can increase your budget.`
              : blockers.length > 0
                ? blockers.map((blocker) => blocker.message).join(' ')
                : 'Nothing on record matches this combination of customer type, coverage area, currency and age. Try changing one of them.',
          action: <ButtonLink to={ROUTES.comparison.new}>Change selection</ButtonLink>,
        }}
      >
        {() => (
          <div className="space-y-6">
            {recommended ? (
              <RecommendedPlanCard
                plan={recommended}
                reasons={result?.recommendationReasons ?? []}
                criteria={criteria}
                onPreview={(plan) => setPreviewing(plan.configurationId)}
              />
            ) : null}

            {alternatives.length > 0 ? (
              <section>
                <h2 className="text-content mb-3 text-lg font-semibold">Other matching plans</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {alternatives.map((plan) => (
                    <AlternativePlanCard
                      key={plan.configurationId}
                      plan={plan}
                      onPreview={(chosen) => setPreviewing(chosen.configurationId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="text-content mb-3 text-lg font-semibold">Side by side</h2>
              <ComparisonTable
                plans={result?.plans ?? []}
                benefits={result?.criteria.benefits ?? []}
              />
            </section>
          </div>
        )}
      </DataState>

      {/*
        What the next bracket up buys. Shown beneath the affordable plans —
        and on its own when nothing fitted — so the budget is never a dead end.
        These are scored among themselves, so the star here means "best of the
        plans above your budget", not a second opinion on the ones below it.
      */}
      {overBudget.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3">
            <h2 className="text-content text-lg font-semibold">Above your budget</h2>
            <p className="text-content-muted mt-1 text-sm">
              {overBudget.length} {overBudget.length === 1 ? 'plan costs' : 'plans cost'} more than{' '}
              {result?.criteria.budget === null || result?.criteria.budget === undefined
                ? 'your budget'
                : `${formatNumber(result.criteria.budget)}${
                    result.criteria.currency ? ` ${result.criteria.currency}` : ''
                  }`}
              . Here is what the extra spend would buy.
            </p>
          </div>

          <div className="space-y-6">
            {overBudgetPick ? (
              <RecommendedPlanCard
                plan={overBudgetPick}
                reasons={result?.overBudgetRecommendationReasons ?? []}
                label="BEST ABOVE YOUR BUDGET"
                tone="warning"
                criteria={criteria}
                onPreview={(plan) => setPreviewing(plan.configurationId)}
              />
            ) : null}

            {overBudgetRest.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {overBudgetRest.map((plan) => (
                  <AlternativePlanCard
                    key={plan.configurationId}
                    plan={plan}
                    onPreview={(chosen) => setPreviewing(chosen.configurationId)}
                  />
                ))}
              </div>
            ) : null}

            <ComparisonTable plans={overBudget} benefits={result?.overBudgetBenefits ?? []} />
          </div>
        </section>
      ) : null}

      {/* Any plan, read where it sits — the winner has no privilege here. */}
      <PlanPreviewDialog
        plan={previewed}
        criteria={criteria}
        ages={ages}
        onClose={() => setPreviewing(null)}
      />
    </>
  );
}
