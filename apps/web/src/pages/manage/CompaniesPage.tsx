import { useMemo, useState } from 'react';
import {
  Badge,
  ButtonLink,
  Card,
  CompanyLogo,
  DataState,
  IconAdd,
  IconChevronRight,
  Input,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useCompanies, usePlans } from '@/features/insurance-data/insurance-data.api';
import type { CompanyDto } from '@aggregator/shared';

/**
 * The list of companies, and the way into every other management screen:
 * picking a company opens its full structure.
 */
export function CompaniesPage() {
  const companies = useCompanies();
  const plans = usePlans();
  const [search, setSearch] = useState('');

  /** Plans per company, so each card can show how much is set up. */
  const planCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plan of plans.data ?? []) {
      counts.set(plan.companyId, (counts.get(plan.companyId) ?? 0) + 1);
    }
    return counts;
  }, [plans.data]);

  const visible = (companies.data ?? []).filter((company) =>
    company.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every insurance company in the system. Open one to manage its plans and benefits."
        actions={
          <ButtonLink to={ROUTES.companies.new}>
            <IconAdd className="size-4" />
            Add company
          </ButtonLink>
        }
      />

      {(companies.data?.length ?? 0) > 0 ? (
        <div className="mb-5 max-w-sm">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search companies…"
            aria-label="Search companies"
          />
        </div>
      ) : null}

      <DataState
        isLoading={companies.isLoading}
        error={companies.error}
        data={companies.data}
        subject="insurance companies"
        onRetry={() => void companies.refetch()}
        empty={{
          title: 'No insurance companies yet',
          description: 'Add your first insurance company to start building the insurance database.',
          action: (
            <ButtonLink to={ROUTES.companies.new}>
              <IconAdd className="size-4" />
              Add company
            </ButtonLink>
          ),
        }}
      >
        {() =>
          visible.length === 0 ? (
            <Card className="px-6 py-12 text-center">
              <p className="text-content font-semibold">No companies match “{search}”</p>
              <p className="text-content-muted mt-1 text-sm">Try a different search term.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  plans={planCount.get(company.id) ?? 0}
                />
              ))}
            </div>
          )
        }
      </DataState>
    </>
  );
}

function CompanyCard({ company, plans }: { company: CompanyDto; plans: number }) {
  return (
    <Card className="hover:border-brand-border flex h-full flex-col p-5 transition-colors">
      <div className="flex items-start gap-3">
        <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-content truncate text-base font-semibold">{company.name}</p>
          <p className="text-content-muted mt-0.5 text-sm">
            {plans === 0 ? 'No plans yet' : `${plans} ${plans === 1 ? 'Plan' : 'Plans'}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge tone={company.isActive ? 'success' : 'neutral'}>
          {company.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <ButtonLink size="sm" variant="secondary" to={ROUTES.companies.detail(company.id)}>
          Manage
          <IconChevronRight className="size-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}
