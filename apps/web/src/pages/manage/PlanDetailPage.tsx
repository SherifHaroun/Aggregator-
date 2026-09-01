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
  bandCountLabel,
  benefitCountLabel,
  priceRangeLabel,
  configurationLabel,
  coverageLabel,
  customerTypeLabel,
  formatMoney,
} from '@/features/insurance-data/labels';

/**
 * A plan and its variants. Each variant is created on its own —
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
  const [pendingDelete, setPendingDelete] = useState<PlanConfigurationDto | null>(null);

  /**
   * By coverage, which is what now separates one variant of a plan from
   * another — age separates the price bands INSIDE a variant, not the variants
   * themselves.
   */
  const configurations = [...(plan.data?.configurations ?? [])].sort(
    (a, b) =>
      a.geographicalCoverage.localeCompare(b.geographicalCoverage) || a.id.localeCompare(b.id),
  );

  return (
    <>
      <PageHeader
        title={plan.data?.name ?? 'Plan'}
        description="Open a variant to edit its cover, its networks and its prices."
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
                {/* Who it is sold to, which is what separates this plan from
                    the identically named one in the next section. The code is
                    database identity and is not shown. */}
                <Detail
                  label="Customer type"
                  value={customerTypeLabel(current!.customerType)}
                />
                {/* The network is a property of each VARIANT, not of the
                    product: one plan is sold on two networks at two prices. It
                    is shown on the variant rows below. */}
                <Detail label="Variants" value={String(configurations.length)} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Variants"
                description="One per coverage scope, network and ceiling. Open one to edit its benefits and prices."
                icon={<IconUsers className="size-5" />}
                action={
                  <Button size="sm" onClick={() => setEditingConfiguration(null)}>
                    <IconAdd className="size-4" />
                    Add variant
                  </Button>
                }
              />
              <CardBody>
                {configurations.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    icon={<IconGlobe className="size-6" />}
                    title="No variants yet"
                    description="Add one for each customer type and coverage area this plan is actually sold for."
                    action={
                      <Button onClick={() => setEditingConfiguration(null)}>
                        <IconAdd className="size-4" />
                        Add variant
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
          companyId={companyId!}
          configuration={editingConfiguration}
          onClose={() => setEditingConfiguration(undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteConfiguration.isPending}
        title="Delete this variant?"
        description="This permanently removes the variant with its benefits, their values and its whole rate table. Other variants of this plan are not affected."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteConfiguration.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify('The variant was deleted.');
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the variant'), 'error');
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
  onDelete,
}: {
  configuration: PlanConfigurationDto;
  companyId: string;
  planId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const benefits = configuration.options?.length ?? 0;

  return (
    <Card className="hover:border-brand-border flex flex-col p-5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        {/* "Gold+ Local" — the plan's name and its scope read together, never
            typed and never stored. */}
        <p className="text-content font-semibold">
          {configuration.displayName ?? coverageLabel(configuration.geographicalCoverage)}
        </p>
        <Badge tone={configuration.isActive ? 'success' : 'neutral'}>
          {configuration.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* The network this variant is sold on: the same plan on two networks is
          two variants at two prices, and the name is what tells them apart. */}
      <p className="text-content-muted mt-1 text-sm font-medium">
        {configuration.medicalNetworkName ?? 'No network stated'}
      </p>

      {/* What it costs across its whole rate table — one figure when a single
          band is priced, a range when the price climbs with age. */}
      <p className="text-content mt-3 text-2xl font-bold">
        {priceRangeLabel(configuration)}
      </p>
      <p className="text-content-muted text-sm">
        {benefitCountLabel(benefits)} · {bandCountLabel(configuration.priceBands.length)}
      </p>

      <div className="mt-auto flex items-center justify-end gap-1 pt-4">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit configuration"
          className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
        >
          <IconEdit className="size-4" />
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
          Open
          <IconChevronRight className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
