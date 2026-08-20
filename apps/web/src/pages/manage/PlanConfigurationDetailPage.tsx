import { useParams } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  DataState,
  IconGlobe,
  IconUsers,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompany,
  useInsuranceOptions,
  usePlan,
  usePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import {
  configurationLabel,
  coverageLabel,
  customerTypeLabel,
  formatMoney,
} from '@/features/insurance-data/labels';
import { ConfigurationOptionsBoard } from '@/features/plan-configuration/ConfigurationOptionsBoard';

/**
 * The benefits of one configuration.
 *
 * Values edited here belong to THIS configuration only — a sibling
 * configuration of the same plan keeps its own.
 */
export function PlanConfigurationDetailPage() {
  const { companyId, planId, configurationId } = useParams();

  const configuration = usePlanConfiguration(configurationId);
  const company = useCompany(companyId);
  const plan = usePlan(planId);

  // The global benefit catalogue: the same list whichever company this is.
  const options = useInsuranceOptions({ isActive: true });

  return (
    <>
      <PageHeader
        title={
          configuration.data
            ? configurationLabel(
                configuration.data.customerType,
                configuration.data.geographicalCoverage,
              )
            : 'Configuration'
        }
        description="Drag benefits in, reorder them, and set the values that apply here."
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
          { label: 'Benefits' },
        ]}
      />

      <DataState
        isLoading={configuration.isLoading}
        error={configuration.error}
        data={configuration.data ? [configuration.data] : undefined}
        subject="the configuration"
        onRetry={() => void configuration.refetch()}
        empty={{ title: 'Configuration not found' }}
      >
        {([current]) => (
          <div className="space-y-5">
            <Card>
              <CardBody className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Summary
                  icon={<IconUsers className="size-4" />}
                  label="Customer type"
                  value={customerTypeLabel(current!.customerType)}
                />
                <Summary
                  icon={<IconGlobe className="size-4" />}
                  label="Coverage"
                  value={coverageLabel(current!.geographicalCoverage)}
                />
                <div>
                  <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">
                    Annual price
                  </p>
                  <p className="text-content mt-1 text-lg font-bold">
                    {formatMoney(current!.annualPrice, current!.currency)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">
                    Status
                  </p>
                  <Badge tone={current!.isActive ? 'success' : 'neutral'}>
                    {current!.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Resolved from the centralized business rule, never stored. */}
                {current!.averageAge.label ? (
                  <div className="border-brand-border bg-brand-soft flex items-center gap-2 rounded-(--radius-control) border px-3 py-2 sm:col-span-2 lg:col-span-4">
                    <IconUsers className="text-brand size-4 shrink-0" />
                    <p className="text-content text-sm font-semibold">
                      {current!.averageAge.label}
                    </p>
                    <p className="text-content-muted text-xs">
                      Fixed by business rule for this customer type.
                    </p>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <ConfigurationOptionsBoard
              configurationId={current!.id}
              attached={current!.options ?? []}
              available={options.data ?? []}
            />
          </div>
        )}
      </DataState>
    </>
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
