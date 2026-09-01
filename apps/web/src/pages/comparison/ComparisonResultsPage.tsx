import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CUSTOMER_TYPE_IDS,
  GEOGRAPHICAL_COVERAGE_IDS,
  PLAN_TIER_IDS,
  formatNumber,
  isSmeAgeBracketId,
  type ComparisonRequestInput,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type PlanTierId,
} from '@aggregator/shared';
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
import { AlternativePlanCard, ComparisonTable, RecommendedPlanCard } from '@/features/comparison';
import { useComparison } from '@/features/insurance-data/insurance-data.api';

/**
 * The comparison results.
 *
 * The selection lives in the URL, so a result can be shared and survives a
 * refresh. Everything shown — which plans matched, how they score and which is
 * recommended — is computed by the API's comparison engine; this screen only
 * renders the answer.
 */
export function ComparisonResultsPage() {
  const [params] = useSearchParams();

  /**
   * The request, or `null` when the URL does not describe a full selection.
   *
   * Every value is checked against what the business actually offers rather
   * than cast and hoped for. A link carrying a customer type this system has
   * never heard of is not a selection, and saying so here is better than
   * sending it to the API to be refused.
   */
  const request = useMemo<ComparisonRequestInput | null>(() => {
    const oneOf = <T extends string>(ids: readonly T[], value: string | null): T | null =>
      value !== null && (ids as readonly string[]).includes(value) ? (value as T) : null;

    const customerTypeId = oneOf<CustomerTypeId>(CUSTOMER_TYPE_IDS, params.get('customerTypeId'));
    const geographicalCoverageId = oneOf<GeographicalCoverageId>(
      GEOGRAPHICAL_COVERAGE_IDS,
      params.get('geographicalCoverageId'),
    );
    const currency = params.get('currency');
    const ageFrom = Number(params.get('ageFrom'));
    const ageTo = Number(params.get('ageTo'));
    const rawBudget = params.get('budget');

    if (!customerTypeId || !geographicalCoverageId || !currency) return null;
    if (!Number.isFinite(ageFrom) || !Number.isFinite(ageTo)) return null;

    /**
     * The tier is OPTIONAL, and its absence is an answer: a customer with no
     * view on how much cover they need sees every tier rather than being made
     * to rule two of them out.
     */
    const planTierId = oneOf<PlanTierId>(PLAN_TIER_IDS, params.get('planTierId'));

    // No budget in the URL means no price ceiling — not an incomplete request.
    const budget = rawBudget === null ? undefined : Number(rawBudget);
    if (budget !== undefined && !Number.isFinite(budget)) return null;

    /**
     * The workforce, one parameter per occupied bracket — `employees=30–34:6`.
     * A bracket this system does not have is dropped rather than sent on: a
     * link written by hand should not be able to price against an age group
     * that does not exist.
     */
    const smeEmployees: Record<string, number> = {};
    for (const entry of params.getAll('employees')) {
      const separator = entry.lastIndexOf(':');
      if (separator === -1) continue;
      const bracketId = entry.slice(0, separator);
      const count = Number(entry.slice(separator + 1));
      if (!isSmeAgeBracketId(bracketId)) continue;
      if (!Number.isInteger(count) || count < 0) continue;
      smeEmployees[bracketId] = count;
    }
    const hasWorkforce = Object.keys(smeEmployees).length > 0;

    return {
      ...(planTierId === null ? {} : { planTierId }),
      ...(hasWorkforce ? { smeEmployees } : {}),
      customerTypeId,
      geographicalCoverageId,
      currency,
      ageFrom,
      ageTo,
      ...(budget === undefined ? {} : { budget }),
    };
  }, [params]);

  const comparison = useComparison(request);

  if (request === null) {
    return (
      <>
        <PageHeader title="Comparison results" />
        <EmptyState
          title="Nothing selected"
          description="Choose the insurance type, who is being insured, an age, a budget, the coverage area and a currency."
          action={<ButtonLink to={ROUTES.comparison.new}>Back to selection</ButtonLink>}
        />
      </>
    );
  }

  const result = comparison.data;
  const recommended = result?.plans.find((plan) => plan.isRecommended);
  const alternatives = result?.plans.filter((plan) => !plan.isRecommended) ?? [];

  const overBudget = result?.overBudgetPlans ?? [];
  const overBudgetPick = overBudget.find((plan) => plan.isRecommended);
  const overBudgetRest = overBudget.filter((plan) => !plan.isRecommended);

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
          <CardBody className="flex flex-wrap items-center gap-2">
            {result.criteria.planTierLabel ? (
              <Badge tone="brand">{result.criteria.planTierLabel}</Badge>
            ) : null}
            <Badge>{result.criteria.customerTypeLabel}</Badge>
            <Badge>{result.criteria.geographicalCoverageLabel}</Badge>
            <Badge>{result.criteria.currency}</Badge>
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
                : result.criteria.ageFrom === result.criteria.ageTo
                  ? `Age ${result.criteria.ageFrom}`
                  : `Ages ${result.criteria.ageFrom}–${result.criteria.ageTo}`}
            </Badge>
            <Badge>
              {result.criteria.budget === null
                ? 'No budget limit'
                : `Budget ${formatNumber(result.criteria.budget)} ${result.criteria.currency}`}
            </Badge>
            <span className="text-content-subtle ml-auto text-xs">
              {result.criteria.benefits.length === 0
                ? 'No benefits recorded on the matching plans'
                : `Benefits found: ${result.criteria.benefits.map((benefit) => benefit.name).join(', ')}`}
            </span>
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
          // The budget is never quietly ignored: when it is what ruled every
          // plan out, say so and offer the way forward.
          title:
            (result?.overBudgetCount ?? 0) > 0
              ? 'No plans found within your budget'
              : 'No plan matches those requirements',
          description:
            (result?.overBudgetCount ?? 0) > 0
              ? `${result?.overBudgetCount} plan${result?.overBudgetCount === 1 ? '' : 's'} match everything else but cost more than your budget. They are listed below, or you can increase your budget.`
              : 'No configuration matches this insurance type, customer type, coverage area, currency and age. Try widening the selection.',
          action: <ButtonLink to={ROUTES.comparison.new}>Change selection</ButtonLink>,
        }}
      >
        {() => (
          <div className="space-y-6">
            {recommended ? (
              <RecommendedPlanCard
                plan={recommended}
                reasons={result?.recommendationReasons ?? []}
              />
            ) : null}

            {alternatives.length > 0 ? (
              <section>
                <h2 className="text-content mb-3 text-lg font-semibold">Other matching plans</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {alternatives.map((plan) => (
                    <AlternativePlanCard key={plan.configurationId} plan={plan} />
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
                : `${formatNumber(result.criteria.budget)} ${result.criteria.currency}`}
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
              />
            ) : null}

            {overBudgetRest.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {overBudgetRest.map((plan) => (
                  <AlternativePlanCard key={plan.configurationId} plan={plan} />
                ))}
              </div>
            ) : null}

            <ComparisonTable plans={overBudget} benefits={result?.overBudgetBenefits ?? []} />
          </div>
        </section>
      ) : null}
    </>
  );
}
