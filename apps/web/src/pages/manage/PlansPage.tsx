import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ButtonLink,
  Card,
  DataState,
  Field,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceTypes,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';
import type { PlanDto } from '@aggregator/shared';

/**
 * All plans across all companies, grouped Company → Insurance type → Plan so
 * the hierarchy is obvious at a glance.
 */
export function PlansPage() {
  const [companyId, setCompanyId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [status, setStatus] = useState('');

  const companies = useCompanies();
  const insuranceTypes = useInsuranceTypes();
  const plans = usePlans({
    ...(companyId ? { companyId } : {}),
    ...(insuranceTypeId ? { insuranceTypeId } : {}),
    ...(status ? { isActive: status === 'active' } : {}),
  });

  const companyName = useMemo(
    () => new Map((companies.data ?? []).map((company) => [company.id, company.name])),
    [companies.data],
  );
  const typeName = useMemo(
    () => new Map((insuranceTypes.data ?? []).map((type) => [type.id, type.name])),
    [insuranceTypes.data],
  );

  /** Company → insurance type → plans. */
  const grouped = useMemo(() => {
    const byCompany = new Map<string, Map<string, PlanDto[]>>();
    for (const plan of plans.data ?? []) {
      const byType = byCompany.get(plan.companyId) ?? new Map<string, PlanDto[]>();
      byType.set(plan.insuranceTypeId, [...(byType.get(plan.insuranceTypeId) ?? []), plan]);
      byCompany.set(plan.companyId, byType);
    }
    return byCompany;
  }, [plans.data]);

  const canCreate = (companies.data?.length ?? 0) > 0 && (insuranceTypes.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Plans"
        description="Insurance products offered by each company. Prices and benefits live in each plan's configurations."
        actions={
          canCreate ? <ButtonLink to={ROUTES.plans.new}>+ Add plan</ButtonLink> : undefined
        }
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Company">
            {(props) => (
              <Select {...props} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">All companies</option>
                {(companies.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Insurance type">
            {(props) => (
              <Select
                {...props}
                value={insuranceTypeId}
                onChange={(e) => setInsuranceTypeId(e.target.value)}
              >
                <option value="">All types</option>
                {(insuranceTypes.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(props) => (
              <Select {...props} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <DataState
        isLoading={plans.isLoading}
        error={plans.error}
        data={plans.data}
        subject="plans"
        onRetry={() => void plans.refetch()}
        empty={{
          title: 'No plans yet',
          description: canCreate
            ? 'Add your first plan to start building the insurance database.'
            : 'Create at least one company and one insurance type first — a plan belongs to both.',
          action: canCreate ? <ButtonLink to={ROUTES.plans.new}>+ Add plan</ButtonLink> : undefined,
        }}
      >
        {() => (
          <div className="space-y-6">
            {[...grouped.entries()].map(([company, byType]) => (
              <section key={company}>
                <h2 className="text-content text-sm font-semibold tracking-wide uppercase">
                  {companyName.get(company) ?? 'Unknown company'}
                </h2>
                <div className="mt-3 space-y-4">
                  {[...byType.entries()].map(([type, typePlans]) => (
                    <Card key={type} className="overflow-hidden">
                      <div className="border-border-subtle bg-surface-muted/60 border-b px-5 py-2.5">
                        <p className="text-content-muted text-xs font-semibold tracking-wide uppercase">
                          {typeName.get(type) ?? 'Unknown insurance type'}
                        </p>
                      </div>
                      <ul className="divide-border-subtle divide-y">
                        {typePlans.map((plan) => (
                          <li key={plan.id}>
                            <Link
                              to={ROUTES.plans.detail(plan.id)}
                              className="hover:bg-surface-muted/40 flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors"
                            >
                              <span className="min-w-0">
                                <span className="text-content block font-medium">{plan.name}</span>
                                <span className="text-content-subtle block text-xs">
                                  {plan.code}
                                  {plan.category ? ` · ${plan.category}` : ''}
                                </span>
                              </span>
                              <StatusBadge isActive={plan.isActive} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </DataState>
    </>
  );
}
