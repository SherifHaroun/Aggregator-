import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  DataState,
  IconCart,
  IconCheck,
  IconChevronRight,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useCustomerSession } from '@/features/auth/auth.api';
import {
  PlanBody,
  parseComparisonRequest,
  usePlanDocumentSource,
  type DocumentAges,
} from '@/features/comparison';
import { useAddCartItem, useCustomer } from '@/features/customers/customers.api';
import { useComparison } from '@/features/insurance-data/insurance-data.api';

/**
 * ONE PLAN, FOR THE CUSTOMER WHO OPENED IT.
 *
 * The same page an employee sees — the premium re-run for these details,
 * every band, the benefits, the PDF — with one difference at the top: the
 * button keeps the plan in the customer's OWN cart, which is the cart the
 * broker's employees see against their name.
 */
export function PublicPlanPage() {
  const { configurationId } = useParams<{ configurationId: string }>();
  const [params] = useSearchParams();
  const request = useMemo(() => parseComparisonRequest(params), [params]);
  const comparison = useComparison(request);
  const { customer } = useCustomerSession();
  const me = useCustomer(customer ? 'me' : undefined);
  const addItem = useAddCartItem();
  const { notify } = useToast();

  const plan =
    [...(comparison.data?.plans ?? []), ...(comparison.data?.overBudgetPlans ?? [])].find(
      (candidate) => candidate.configurationId === configurationId,
    ) ?? null;

  const ages: DocumentAges | null = comparison.data
    ? {
        ageFrom: comparison.data.criteria.ageFrom,
        ageTo: comparison.data.criteria.ageTo,
        assumed: comparison.data.criteria.ageAssumed,
      }
    : null;

  const document = usePlanDocumentSource(configurationId ?? null, plan?.planId ?? null);
  const backToResults = `${ROUTES.public.results}?${params.toString()}`;
  const alreadyKept = me.data?.items.some((item) => item.planConfigurationId === configurationId);

  function keep() {
    if (!plan || !request) return;
    addItem.mutate(
      {
        customerId: 'me',
        planConfigurationId: plan.configurationId,
        criteria: request,
        note: null,
      },
      {
        onSuccess: (item) => notify(`${item.name} is saved in your cart.`),
        onError: (error) => notify(describeError(error, 'your cart'), 'error'),
      },
    );
  }

  if (request === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-content-muted">This link is missing the comparison details.</p>
        <ButtonLink to={`${ROUTES.home}#compare`} className="mt-4">
          Compare plans
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backToResults}
          className="text-content-muted hover:text-content inline-flex items-center gap-1 text-sm"
        >
          <IconChevronRight className="size-4 rotate-180" />
          Back to results
        </Link>
        {plan ? (
          alreadyKept ? (
            <ButtonLink variant="secondary" to={ROUTES.public.cart}>
              <IconCheck className="text-success size-4" />
              Saved · View my cart
            </ButtonLink>
          ) : (
            <Button onClick={keep} disabled={addItem.isPending}>
              <IconCart className="size-4" />
              {addItem.isPending ? 'Saving…' : 'Save to my cart'}
            </Button>
          )
        ) : null}
      </div>

      <DataState
        isLoading={comparison.isLoading}
        error={comparison.error}
        data={plan ? [plan] : []}
        subject="this plan"
        onRetry={() => void comparison.refetch()}
        empty={{
          title: 'This plan is not in your results',
          description: 'It may no longer be on sale for these details.',
          action: <ButtonLink to={backToResults}>Back to results</ButtonLink>,
        }}
      >
        {() =>
          plan ? (
            <PlanBody
              plan={plan}
              document={document}
              ages={ages}
              customerName={customer?.name ?? null}
            />
          ) : null
        }
      </DataState>
    </div>
  );
}
