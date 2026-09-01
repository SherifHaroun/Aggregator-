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
import { customerTypeLabel } from '@/features/insurance-data/labels';
import {
  useCompanies,
  usePlanConfigurations,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';
import {
  PLAN_TIERS,
  planTier,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanTierId,
} from '@aggregator/shared';

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
  /** The plans list does not carry configurations, so they are counted here. */
  const configurations = usePlanConfigurations();

  const companyName = useMemo(
    () => new Map((companies.data ?? []).map((company) => [company.id, company.name])),
    [companies.data],
  );

  /** Each plan's variants, so a plan can be shown the tiers its ceilings read as. */
  const configurationsByPlan = useMemo(() => {
    const byPlan = new Map<string, PlanConfigurationDto[]>();
    for (const configuration of configurations.data ?? []) {
      const list = byPlan.get(configuration.planId) ?? [];
      list.push(configuration);
      byPlan.set(configuration.planId, list);
    }
    return byPlan;
  }, [configurations.data]);

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
        /**
         * Read off each variant's annual limit rather than filed by hand. A
         * plan sold at 30,000 locally and 150,000 internationally is genuinely
         * Basic one way and Premium the other, so both are named.
         */
        key: 'tier',
        header: 'Tier',
        render: (plan) => {
          const tiers = [
            ...new Set(
              (configurationsByPlan.get(plan.id) ?? [])
                .map((variant) => planTier(variant.annualLimit))
                .filter((tier): tier is PlanTierId => tier !== null)
                .map((tier) => PLAN_TIERS[tier].label),
            ),
          ];
          return tiers.length === 0 ? '—' : tiers.join(', ');
        },
      },
      {
        key: 'customerType',
        header: 'Customer type',
        hideOnMobile: true,
        render: (plan) => (
          <span className="text-content-muted">{customerTypeLabel(plan.customerType)}</span>
        ),
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
    [companyName, configurationCount, configurationsByPlan],
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
