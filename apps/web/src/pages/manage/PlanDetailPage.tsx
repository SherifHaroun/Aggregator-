import type { PlanConfigurationDto } from '@aggregator/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  EmptyState,
  IconAdd,
  IconChevronRight,
  IconCopy,
  IconEdit,
  IconGlobe,
  IconLayers,
  IconTrash,
  IconUsers,
  PageHeader,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { ConfigurationDialog } from '@/features/company-setup/ConfigurationDialog';
import { CopyPlanDialog } from '@/features/company-setup/CopyPlanDialog';
import { PlanDialog } from '@/features/company-setup/PlanDialog';
import {
  useCompany,
  useDeletePlanConfiguration,
  usePlan,
} from '@/features/insurance-data/insurance-data.api';
import {
  benefitCountLabel,
  configurationLabel,
  formatMoney,
} from '@/features/insurance-data/labels';

/**
 * A plan and its configurations. Configurations are created individually —
 * never generated automatically — so only the combinations this product is
 * actually sold for exist.
 */
export function PlanDetailPage() {
  const { companyId, planId } = useParams();
  const { notify } = useToast();

  const company = useCompany(companyId);
  const plan = usePlan(planId);
  const deleteConfiguration = useDeletePlanConfiguration();

  const [editingPlan, setEditingPlan] = useState(false);
  /** True while the employee is copying this plan into a new one. */
  const [copyingPlan, setCopyingPlan] = useState(false);
  const [editingConfiguration, setEditingConfiguration] = useState<
    PlanConfigurationDto | null | undefined
  >(undefined);
  /** The configuration being copied to another age band, if any. */
  const [duplicating, setDuplicating] = useState<PlanConfigurationDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanConfigurationDto | null>(null);

  /**
   * Youngest band first. Age is what separates most configurations of a plan,
   * so reading them in age order is how the price table in a plan document
   * reads.
   */
  const configurations = [...(plan.data?.configurations ?? [])].sort(
    (a, b) => a.ageFrom - b.ageFrom || a.ageTo - b.ageTo,
  );

  return (
    <>
      <PageHeader
        title={plan.data?.name ?? 'Plan'}
        description="Each configuration below carries its own price and its own benefits."
        breadcrumbs={[
          { label: 'Companies', to: ROUTES.companies.list },
          {
            label: company.data?.name ?? 'Company',
            ...(companyId ? { to: ROUTES.companies.detail(companyId) } : {}),
          },
          { label: plan.data?.name ?? 'Plan' },
        ]}
        media={
          <span className="bg-brand-soft text-brand flex size-14 items-center justify-center rounded-2xl">
            <IconLayers className="size-7" />
          </span>
        }
        actions={
          plan.data ? (
            <>
              {/* One product priced several ways is the norm: copy it rather
                  than re-enter every benefit for the next tier. */}
              <Button variant="secondary" onClick={() => setCopyingPlan(true)}>
                <IconCopy className="size-4" />
                Copy plan
              </Button>
              <Button variant="secondary" onClick={() => setEditingPlan(true)}>
                <IconEdit className="size-4" />
                Edit plan
              </Button>
            </>
          ) : undefined
        }
      />

      <DataState
        isLoading={plan.isLoading}
        error={plan.error}
        data={plan.data ? [plan.data] : undefined}
        subject="the plan"
        onRetry={() => void plan.refetch()}
        empty={{ title: 'Plan not found' }}
      >
        {([current]) => (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Plan details"
                icon={<IconLayers className="size-5" />}
                action={
                  <Badge tone={current!.isActive ? 'success' : 'neutral'}>
                    {current!.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                }
              />
              <CardBody className="grid gap-4 sm:grid-cols-3">
                <Detail label="Plan code" value={current!.code} />
                {/* The company network this plan is sold on. Blank where the
                    document does not say — never guessed. */}
                <Detail
                  label="Medical network"
                  value={current!.medicalNetworkName ?? 'Not stated'}
                />
                <Detail label="Configurations" value={String(configurations.length)} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Configurations"
                description="One per customer type and coverage area."
                icon={<IconUsers className="size-5" />}
                action={
                  <Button size="sm" onClick={() => setEditingConfiguration(null)}>
                    <IconAdd className="size-4" />
                    Add configuration
                  </Button>
                }
              />
              <CardBody>
                {configurations.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    icon={<IconGlobe className="size-6" />}
                    title="No configurations yet"
                    description="Add one for each customer type and coverage area this plan is actually sold for."
                    action={
                      <Button onClick={() => setEditingConfiguration(null)}>
                        <IconAdd className="size-4" />
                        Add configuration
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {configurations.map((configuration) => (
                      <ConfigurationCard
                        key={configuration.id}
                        configuration={configuration}
                        companyId={companyId!}
                        planId={planId!}
                        onEdit={() => setEditingConfiguration(configuration)}
                        onDuplicate={() => setDuplicating(configuration)}
                        onDelete={() => setPendingDelete(configuration)}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>

      {copyingPlan && companyId && plan.data ? (
        <CopyPlanDialog
          companyId={companyId}
          plan={plan.data}
          onClose={() => setCopyingPlan(false)}
        />
      ) : null}

      {editingPlan && companyId && plan.data ? (
        <PlanDialog companyId={companyId} plan={plan.data} onClose={() => setEditingPlan(false)} />
      ) : null}

      {editingConfiguration !== undefined && planId ? (
        <ConfigurationDialog
          planId={planId}
          configuration={editingConfiguration}
          onClose={() => setEditingConfiguration(undefined)}
        />
      ) : null}

      {/* The same cover at another age: benefits and values travel with it. */}
      {duplicating && planId ? (
        <ConfigurationDialog
          planId={planId}
          configuration={null}
          duplicateOf={duplicating}
          onClose={() => setDuplicating(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteConfiguration.isPending}
        title="Delete this configuration?"
        description="This permanently removes the configuration with its benefits and their values. Other configurations of this plan are not affected."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteConfiguration.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify('The configuration was deleted.');
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the configuration'), 'error');
              setPendingDelete(null);
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
      <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-content mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ConfigurationCard({
  configuration,
  companyId,
  planId,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  configuration: PlanConfigurationDto;
  companyId: string;
  planId: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const benefits = configuration.options?.length ?? 0;

  return (
    <Card className="hover:border-brand-border flex flex-col p-5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-content font-semibold">
          {configurationLabel(configuration.customerType, configuration.geographicalCoverage)}
        </p>
        <Badge tone={configuration.isActive ? 'success' : 'neutral'}>
          {configuration.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* The band this price applies to — what distinguishes one card from the
          next when a plan is priced age by age. */}
      <p className="text-content-muted mt-1 text-sm font-medium">
        Ages {configuration.ageFrom}–{configuration.ageTo}
      </p>

      <p className="text-content mt-3 text-2xl font-bold">
        {formatMoney(configuration.annualPrice, configuration.currency)}
      </p>
      <p className="text-content-muted text-sm">{benefitCountLabel(benefits)}</p>

      {/* Resolved from the centralized business rule, never stored. */}
      {configuration.averageAge.label ? (
        <p className="text-brand-strong bg-brand-soft mt-3 inline-flex w-fit items-center gap-1.5 rounded-(--radius-pill) px-2.5 py-1 text-xs font-semibold">
          <IconUsers className="size-3.5" />
          {configuration.averageAge.label}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-1 pt-4">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit configuration"
          className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
        >
          <IconEdit className="size-4" />
        </button>
        {/* The whole point of the card for an age-priced plan: repeat it for
            the next band without re-entering a single benefit. */}
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Add different age"
          title="Add different age"
          className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
        >
          <IconCopy className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete configuration"
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-2"
        >
          <IconTrash className="size-4" />
        </button>
        <Link
          to={ROUTES.configurations.detail(companyId, planId, configuration.id)}
          className="text-brand-strong bg-brand-soft hover:bg-brand hover:text-content-inverted ml-1 inline-flex items-center gap-1 rounded-(--radius-control) px-3 py-2 text-sm font-semibold transition-colors"
        >
          Benefits
          <IconChevronRight className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
