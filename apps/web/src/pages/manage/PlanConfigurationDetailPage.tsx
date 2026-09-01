import { useParams } from 'react-router-dom';
import { DataState, IconUsers, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompany,
  useInsuranceOptions,
  useMedicalNetworks,
  usePlan,
  usePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { customerTypeLabel } from '@/features/insurance-data/labels';
import { VariantEditorForm } from '@/features/plan-configuration/VariantEditorForm';

/**
 * ONE VARIANT, WHOLE, AND EDITABLE.
 *
 * Opening "Gold+ Local" shows the variant itself rather than a summary of it:
 * what it covers and on what terms, the six core areas every plan is judged on,
 * whichever additional benefits it states, and the premium at every age it is
 * sold at. Splitting those across three screens is how half-entered plans
 * happen — they are one document to the person reading them off a PDF.
 *
 * Who the plan is for is NOT edited here. It belongs to the plan, and changing
 * it would move every variant beneath it at once, so it is shown as context.
 *
 * Values edited here belong to THIS variant only — a sibling variant of the
 * same plan keeps its own.
 */
export function PlanConfigurationDetailPage() {
  const { companyId, planId, configurationId } = useParams();

  const configuration = usePlanConfiguration(configurationId);
  const company = useCompany(companyId);
  const plan = usePlan(planId);
  const networks = useMedicalNetworks(companyId);

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
          plan.data ? (
            /* Context, not a choice: the buyer is the plan's, and every variant
               beneath it shares it. The average age comes with it wherever the
               business rules fix one. */
            <span className="text-content-muted inline-flex items-center gap-1.5 text-sm font-medium">
              <IconUsers className="text-brand size-4" />
              {customerTypeLabel(plan.data.customerType)}
              {plan.data.averageAge?.label ? ` · ${plan.data.averageAge.label}` : ''}
            </span>
          ) : undefined
        }
      />

      <DataState
        isLoading={configuration.isLoading || plan.isLoading || options.isLoading}
        error={configuration.error}
        data={configuration.data && plan.data ? [configuration.data] : undefined}
        subject="the variant"
        onRetry={() => void configuration.refetch()}
        empty={{ title: 'Variant not found' }}
      >
        {([current]) => (
          <VariantEditorForm
            /* Remounted when the record changes, so the draft is always seeded
               from what was actually saved. */
            key={`${current!.id}:${current!.updatedAt}`}
            variant={current!}
            planName={plan.data!.name}
            customerType={plan.data!.customerType}
            catalogue={options.data ?? []}
            networks={networks.data ?? []}
          />
        )}
      </DataState>
    </>
  );
}
