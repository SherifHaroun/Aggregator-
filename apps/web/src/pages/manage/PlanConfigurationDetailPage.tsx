import { formatPercentage } from '@aggregator/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataState,
  IconEdit,
  IconGlobe,
  IconUsers,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { ConfigurationDialog } from '@/features/company-setup/ConfigurationDialog';
import {
  useCompany,
  useInsuranceOptions,
  usePlan,
  usePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { coverageLabel, customerTypeLabel, formatMoney } from '@/features/insurance-data/labels';
import { AgePricingCard } from '@/features/plan-configuration/AgePricingCard';
import { ConfigurationOptionsBoard } from '@/features/plan-configuration/ConfigurationOptionsBoard';

/**
 * ONE VARIANT, WHOLE.
 *
 * Opening "Gold+ Local" shows the variant itself and not a summary of it: what
 * it covers and on what terms, every benefit it carries with the values that
 * apply here, and the premium at every age it is sold at. All of it editable,
 * on one page, because a variant is the thing an employee actually works on and
 * sending them to three screens to finish one product is how half-entered plans
 * happen.
 *
 * What is NOT here is deliberate. Who the plan is for belongs to the plan, so
 * it is shown as context rather than offered as a choice; changing it would
 * move every variant beneath it at once, which is a decision about the plan.
 *
 * Values edited here belong to THIS variant only — a sibling variant of the
 * same plan keeps its own.
 */
export function PlanConfigurationDetailPage() {
  const { companyId, planId, configurationId } = useParams();

  const configuration = usePlanConfiguration(configurationId);
  const company = useCompany(companyId);
  const plan = usePlan(planId);
  const [editingTerms, setEditingTerms] = useState(false);

  // The global benefit catalogue: the same list whichever company this is.
  const options = useInsuranceOptions({ isActive: true });

  return (
    <>
      <PageHeader
        title={configuration.data?.displayName ?? 'Variant'}
        description="Everything this variant covers, and what it costs at every age."
        breadcrumbs={[
          { label: 'Companies', to: ROUTES.companies.list },
          {
            label: company.data?.name ?? 'Company',
            ...(companyId ? { to: ROUTES.companies.detail(companyId) } : {}),
          },
          {
            label: plan.data?.name ?? 'Plan',
            ...(companyId && planId ? { to: ROUTES.plans.detail(companyId, planId) } : {}),
          },
          { label: configuration.data?.displayName ?? 'Variant' },
        ]}
        actions={
          configuration.data ? (
            <Button variant="secondary" onClick={() => setEditingTerms(true)}>
              <IconEdit className="size-4" />
              Edit terms
            </Button>
          ) : undefined
        }
      />

      <DataState
        isLoading={configuration.isLoading}
        error={configuration.error}
        data={configuration.data ? [configuration.data] : undefined}
        subject="the variant"
        onRetry={() => void configuration.refetch()}
        empty={{ title: 'Variant not found' }}
      >
        {([current]) => (
          <div className="space-y-5">
            <Card>
              <CardBody className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* Context, not a choice: the customer type is the plan's, and
                    every variant beneath it shares it. */}
                <Summary
                  icon={<IconUsers className="size-4" />}
                  label="Customer type"
                  value={plan.data ? customerTypeLabel(plan.data.customerType) : '—'}
                />
                <Summary
                  icon={<IconGlobe className="size-4" />}
                  label="Coverage"
                  value={coverageLabel(current!.geographicalCoverage)}
                />
                <Figure label="Medical network" value={current!.medicalNetworkName ?? 'Not stated'} />
                {/* Blank figures read as the plan's own silence rather than as
                    zero — the wording comes from the business rules. */}
                <Figure
                  label="Annual limit"
                  value={formatMoney(current!.annualLimit, current!.currency)}
                />
                <Figure
                  label="Deductible"
                  value={formatMoney(current!.deductible, current!.currency)}
                />
                <Figure label="Co-payment" value={formatPercentage(current!.coPayment)} />
                <div className="flex flex-col items-start gap-2">
                  <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">
                    Status
                  </p>
                  <Badge tone={current!.isActive ? 'success' : 'neutral'}>
                    {current!.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Resolved from the centralized business rule, never stored. */}
                {plan.data?.averageAge.label ? (
                  <div className="border-brand-border bg-brand-soft flex items-center gap-2 rounded-(--radius-control) border px-3 py-2 sm:col-span-2 lg:col-span-4">
                    <IconUsers className="text-brand size-4 shrink-0" />
                    <p className="text-content text-sm font-semibold">
                      {plan.data.averageAge.label}
                    </p>
                    <p className="text-content-muted text-xs">
                      Fixed by business rule for this customer type.
                    </p>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            {/* The benefits this variant carries, valued once for the whole
                variant rather than once per age band. */}
            {plan.data ? (
              <ConfigurationOptionsBoard
                configurationId={current!.id}
                customerType={plan.data.customerType}
                attached={current!.options ?? []}
                available={options.data ?? []}
              />
            ) : null}

            <AgePricingCard variant={current!} />

            {editingTerms && planId ? (
              <ConfigurationDialog
                planId={planId}
                companyId={companyId!}
                configuration={current!}
                onClose={() => setEditingTerms(false)}
              />
            ) : null}
          </div>
        )}
      </DataState>
    </>
  );
}

/** A figure of the variant, or what the plan says instead of one. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-content mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-content mt-1 flex items-center gap-1.5 text-lg font-bold">
        <span className="text-brand">{icon}</span>
        {value}
      </p>
    </div>
  );
}
