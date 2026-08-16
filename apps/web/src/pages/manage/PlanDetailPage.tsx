import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatusBadge,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useDeletePlan,
  useDeletePlanConfiguration,
  usePlan,
} from '@/features/insurance-data/insurance-data.api';
import {
  benefitCountLabel,
  configurationLabel,
  formatMoney,
} from '@/features/insurance-data/labels';
import { DataState } from '@/components/ui';
import type { PlanConfigurationDto } from '@aggregator/shared';

/**
 * A plan and its configurations. Configurations are created individually —
 * never generated automatically — so the plan only ever shows the combinations
 * that genuinely exist for the product.
 */
export function PlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const plan = usePlan(planId);
  const deletePlan = useDeletePlan();
  const deleteConfiguration = useDeletePlanConfiguration();

  const [confirmPlanDelete, setConfirmPlanDelete] = useState(false);
  const [pendingConfiguration, setPendingConfiguration] = useState<PlanConfigurationDto | null>(null);

  const configurations = plan.data?.configurations ?? [];

  return (
    <>
      <PageHeader
        title={plan.data?.name ?? 'Plan'}
        description={plan.data?.description ?? undefined}
        actions={
          plan.data ? (
            <>
              <ButtonLink variant="secondary" to={ROUTES.plans.edit(plan.data.id)}>
                Edit plan
              </ButtonLink>
              <Button variant="ghost" onClick={() => setConfirmPlanDelete(true)}>
                Delete
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Link to={ROUTES.plans.list} className="text-content-muted hover:text-content text-sm">
          ← All plans
        </Link>
      </div>

      <DataState
        isLoading={plan.isLoading}
        error={plan.error}
        data={plan.data ? [plan.data] : undefined}
        subject="the plan"
        onRetry={() => void plan.refetch()}
        empty={{ title: 'Plan not found' }}
      >
        {([current]) => (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Plan details"
                action={<StatusBadge isActive={current!.isActive} />}
              />
              <CardBody className="grid gap-4 sm:grid-cols-3">
                <Detail label="Plan code" value={current!.code} />
                <Detail label="Category" value={current!.category ?? '—'} />
                <Detail label="Configurations" value={String(configurations.length)} />
              </CardBody>
            </Card>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-content text-lg font-semibold">Configurations</h2>
                  <p className="text-content-muted text-sm">
                    One per customer type and geographical coverage. Price and benefits are set on
                    each.
                  </p>
                </div>
                <ButtonLink to={ROUTES.planConfigurations.new(current!.id)}>
                  + Add configuration
                </ButtonLink>
              </div>

              {configurations.length === 0 ? (
                <EmptyState
                  title="No configurations yet"
                  description="Add a configuration for each customer type and coverage area this plan is actually sold for."
                  action={
                    <ButtonLink to={ROUTES.planConfigurations.new(current!.id)}>
                      + Add configuration
                    </ButtonLink>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {configurations.map((configuration) => (
                    <ConfigurationCard
                      key={configuration.id}
                      configuration={configuration}
                      onDelete={() => setPendingConfiguration(configuration)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={confirmPlanDelete}
        onClose={() => setConfirmPlanDelete(false)}
        busy={deletePlan.isPending}
        title={`Delete ${plan.data?.name ?? 'plan'}?`}
        description="This permanently removes the plan together with all of its configurations, their benefits and values. Deactivate the plan instead if it has been quoted or compared."
        onConfirm={() => {
          if (!planId) return;
          deletePlan.mutate(planId, {
            onSuccess: () => {
              notify('The plan was deleted.');
              navigate(ROUTES.plans.list);
            },
            onError: (error) => {
              notify(describeError(error, 'the plan'), 'error');
              setConfirmPlanDelete(false);
            },
          });
        }}
      />

      <ConfirmDialog
        open={pendingConfiguration !== null}
        onClose={() => setPendingConfiguration(null)}
        busy={deleteConfiguration.isPending}
        title="Delete this configuration?"
        description="This permanently removes the configuration together with its benefits and their values. Other configurations of this plan are not affected."
        onConfirm={() => {
          if (!pendingConfiguration) return;
          deleteConfiguration.mutate(pendingConfiguration.id, {
            onSuccess: () => {
              notify('The configuration was deleted.');
              setPendingConfiguration(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the configuration'), 'error');
              setPendingConfiguration(null);
            },
          });
        }}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-content-subtle text-xs tracking-wide uppercase">{label}</p>
      <p className="text-content mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ConfigurationCard({
  configuration,
  onDelete,
}: {
  configuration: PlanConfigurationDto;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-content font-semibold">
          {configurationLabel(configuration.customerType, configuration.geographicalCoverage)}
        </p>
        <StatusBadge isActive={configuration.isActive} />
      </div>

      <p className="text-content mt-3 text-xl font-semibold">
        {formatMoney(configuration.annualPrice, configuration.currency)}
      </p>
      <p className="text-content-muted text-sm">
        {benefitCountLabel(configuration.options?.length ?? 0)}
      </p>

      {/* Resolved from the centralized business rule, never entered or stored. */}
      {configuration.averageAge.label ? (
        <p className="text-content-subtle mt-1 text-xs">{configuration.averageAge.label}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onDelete}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) px-2.5 py-1.5 text-sm font-medium"
        >
          Delete
        </button>
        <ButtonLink size="sm" variant="secondary" to={ROUTES.planConfigurations.detail(configuration.id)}>
          Configure
        </ButtonLink>
      </div>
    </Card>
  );
}
