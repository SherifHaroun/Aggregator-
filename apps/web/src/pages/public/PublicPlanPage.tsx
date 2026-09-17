import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  Callout,
  DataState,
  IconCheck,
  IconChevronRight,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  PlanBody,
  parseComparisonRequest,
  usePlanDocumentSource,
  type DocumentAges,
} from '@/features/comparison';
import { useComparison } from '@/features/insurance-data/insurance-data.api';
import { leadIdOf } from '@/features/leads/lead-session';
import { useChoosePlan, useLead, useRecordPlanView } from '@/features/leads/leads.api';

/**
 * ONE PLAN, FOR THE VISITOR WHO OPENED IT.
 *
 * The same page an employee sees — the premium re-run for these details,
 * every band, the benefits, the PDF — with two differences. Opening it is
 * itself an event: the lead notes which plan was read and the PDF goes to
 * the visitor's inbox, once per plan. And the button at the top does not
 * save anything for later: it CHOOSES. One click, and the plan is in their
 * cart as their choice, the PDF is sent again, and the broker calls.
 */
export function PublicPlanPage() {
  const { configurationId } = useParams<{ configurationId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const request = useMemo(() => parseComparisonRequest(params), [params]);
  const leadId = leadIdOf(params);
  const comparison = useComparison(leadId ? request : null);
  const lead = useLead(leadId);
  const recordView = useRecordPlanView();
  const choose = useChoosePlan();
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

  /**
   * OPENING THE PLAN IS THE EVENT. Once the plan is known to be in the
   * results and the lead is known not to have opened it before, note it —
   * once, whatever React does with effects in development.
   */
  const noted = useRef<string | null>(null);
  const alreadyViewed = lead.data?.views.some(
    (view) => view.planConfigurationId === configurationId,
  );
  useEffect(() => {
    if (!leadId || !plan || !lead.data || alreadyViewed) return;
    if (noted.current === plan.configurationId) return;
    noted.current = plan.configurationId;
    recordView.mutate({ leadId, planConfigurationId: plan.configurationId });
    // The mutation object changes identity; the intent does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, plan?.configurationId, lead.data?.id, alreadyViewed]);

  const chosenHere = lead.data?.choice?.planConfigurationId === configurationId;

  /**
   * WHAT HAPPENED TO THE PDF, honestly. "In your inbox" only once the server
   * says it sent it; while it is being sent, say so; and when the server
   * could not — no mail set up, or a failure — promise the adviser instead
   * of an email that never came.
   */
  const thisView = lead.data?.views.find((view) => view.planConfigurationId === configurationId);
  const pdfNotice =
    !lead.data || !plan
      ? null
      : thisView?.emailStatus === 'SENT'
        ? { title: 'The PDF of this plan is in your inbox', tone: 'info' as const }
        : thisView && thisView.emailStatus !== 'PENDING'
          ? {
              title: 'A Hadbrok adviser will send you the full plan',
              tone: 'warning' as const,
            }
          : recordView.isError
            ? { title: 'A Hadbrok adviser will send you the full plan', tone: 'warning' as const }
            : { title: 'Sending the PDF of this plan to your inbox', tone: 'info' as const };

  function chooseThis() {
    if (!plan || !leadId) return;
    choose.mutate(
      { leadId, planConfigurationId: plan.configurationId },
      {
        onSuccess: () => navigate(`${ROUTES.public.chosen}?${params.toString()}`),
        onError: (error) => notify(describeError(error, 'your choice'), 'error'),
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

  /* A plan is opened from the results, and the results are for somebody. */
  if (leadId === null) {
    return <Navigate to={`${ROUTES.public.details}?${params.toString()}`} replace />;
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
          chosenHere ? (
            <ButtonLink variant="secondary" to={`${ROUTES.public.chosen}?${params.toString()}`}>
              <IconCheck className="text-success size-4" />
              Your choice · What happens next
            </ButtonLink>
          ) : (
            <Button onClick={chooseThis} disabled={choose.isPending} size="lg">
              <IconCheck className="size-4" />
              {choose.isPending ? 'Choosing…' : 'Choose this plan'}
            </Button>
          )
        ) : null}
      </div>

      {pdfNotice && lead.data ? (
        <Callout tone={pdfNotice.tone} title={pdfNotice.title}>
          {lead.data.email} · Choose this plan and a Hadbrok adviser will contact you within 24
          hours.
        </Callout>
      ) : null}

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
              customerName={lead.data?.name ?? null}
            />
          ) : null
        }
      </DataState>
    </div>
  );
}
