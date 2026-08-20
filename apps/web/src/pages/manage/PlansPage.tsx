import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  ButtonLink,
  DataState,
  DataTable,
  IconAdd,
  IconChevronRight,
  PageHeader,
  type Column,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceTypes,
  usePlanConfigurations,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';
import type { PlanDto } from '@aggregator/shared';

/**
 * Every plan in the database, across all companies.
 *
 * A read-only overview: plans are created and edited inside their company, so
 * each row leads there rather than offering a second place to edit the same
 * record.
 */
export function PlansPage() {
  const plans = usePlans();
  const companies = useCompanies();
  const insuranceTypes = useInsuranceTypes();
  /** The plans list does not carry configurations, so they are counted here. */
  const configurations = usePlanConfigurations();

  const companyName = useMemo(
    () => new Map((companies.data ?? []).map((company) => [company.id, company.name])),
    [companies.data],
  );

  const typeName = useMemo(
    () => new Map((insuranceTypes.data ?? []).map((type) => [type.id, type.name])),
    [insuranceTypes.data],
  );

  const configurationCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const configuration of configurations.data ?? []) {
      counts.set(configuration.planId, (counts.get(configuration.planId) ?? 0) + 1);
    }
    return counts;
  }, [configurations.data]);

  const columns: Column<PlanDto>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Plan',
        render: (plan) => <span className="text-content font-semibold">{plan.name}</span>,
      },
      {
        key: 'company',
        header: 'Company',
        render: (plan) => (
          <Link
            to={ROUTES.companies.detail(plan.companyId)}
            className="text-brand-strong hover:text-brand font-medium"
          >
            {companyName.get(plan.companyId) ?? 'Unknown company'}
          </Link>
        ),
      },
      {
        key: 'type',
        header: 'Insurance type',
        render: (plan) => typeName.get(plan.insuranceTypeId) ?? '—',
      },
      {
        key: 'code',
        header: 'Code',
        hideOnMobile: true,
        render: (plan) => <span className="text-content-muted">{plan.code}</span>,
      },
      {
        key: 'configurations',
        header: 'Configurations',
        hideOnMobile: true,
        render: (plan) => {
          const count = configurationCount.get(plan.id) ?? 0;
          return (
            <span className="tabular-nums">
              {count === 0 ? <span className="text-content-subtle">None yet</span> : count}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (plan) => (
          <Badge tone={plan.isActive ? 'success' : 'neutral'}>
            {plan.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [companyName, configurationCount, typeName],
  );

  return (
    <>
      <PageHeader
        title="Plans"
        description="Every plan across all companies. Open one to manage its configurations and benefits."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Plans' }]}
      />

      <DataState
        isLoading={plans.isLoading}
        error={plans.error}
        data={plans.data}
        subject="plans"
        onRetry={() => void plans.refetch()}
        empty={{
          title: 'No plans yet',
          description: 'Plans belong to a company. Add a company, then set up the plans it offers.',
          action: (
            <ButtonLink to={ROUTES.companies.new}>
              <IconAdd className="size-4" />
              Add company
            </ButtonLink>
          ),
        }}
      >
        {(items) => (
          <DataTable
            columns={columns}
            items={items}
            getRowKey={(plan) => plan.id}
            actions={(plan) => (
              <ButtonLink
                size="sm"
                variant="secondary"
                to={ROUTES.plans.detail(plan.companyId, plan.id)}
              >
                Manage
                <IconChevronRight className="size-4" />
              </ButtonLink>
            )}
          />
        )}
      </DataState>
    </>
  );
}
