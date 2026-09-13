import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, DataState, IconCart, IconChevronRight } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  PlanBody,
  comparisonCustomerId,
  parseComparisonRequest,
  usePlanDocumentSource,
  type DocumentAges,
} from '@/features/comparison';
import { AddToCartDialog } from '@/features/customers/AddToCartDialog';
import { useCustomer } from '@/features/customers/customers.api';
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

  /**
   * Keeping the comparison for the customer it was run for, with this plan.
   * The customer came with the link from the results; without one there is
   * no cart to add to, and the button is not drawn.
   */
  const [addingToCart, setAddingToCart] = useState(false);
  const customer = useCustomer(comparisonCustomerId(params) ?? undefined);
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
        {plan && customer.data ? (
          <Button onClick={() => setAddingToCart(true)}>
            <IconCart className="size-4" />
            Add to {customer.data.name}’s cart
          </Button>
        ) : null}
      </div>

      {addingToCart && request && plan && customer.data ? (
        <AddToCartDialog
          customer={customer.data}
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
        {() =>
          plan ? (
            <PlanBody
              plan={plan}
              document={document}
              ages={ages}
              customerName={customer.data?.name ?? null}
            />
          ) : null
        }
      </DataState>
    </div>
  );
}
