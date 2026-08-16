import { Link } from 'react-router-dom';
import {
  ButtonLink,
  Card,
  CompanyLogo,
  EmptyState,
  IconAdd,
  IconBuilding,
  IconChevronRight,
  IconLayers,
  IconShield,
  IconUsers,
  PageHeader,
  StatTile,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceOptions,
  usePlanConfigurations,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';

/**
 * A high-level read of what has been entered so far, and a way straight into
 * the work. Every number comes from the database; nothing is invented.
 */
export function DashboardPage() {
  const companies = useCompanies();
  const plans = usePlans();
  const configurations = usePlanConfigurations({ isActive: true });
  const options = useInsuranceOptions();

  const loading =
    companies.isLoading || plans.isLoading || configurations.isLoading || options.isLoading;

  const total =
    (companies.data?.length ?? 0) +
    (plans.data?.length ?? 0) +
    (configurations.data?.length ?? 0) +
    (options.data?.length ?? 0);

  const recent = (companies.data ?? []).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of the insurance database you are building."
        actions={
          <ButtonLink to={ROUTES.companies.new}>
            <IconAdd className="size-4" />
            Add company
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Companies"
          value={companies.data?.length}
          loading={loading}
          icon={<IconBuilding className="size-5" />}
        />
        <StatTile
          label="Plans"
          value={plans.data?.length}
          loading={loading}
          icon={<IconLayers className="size-5" />}
        />
        <StatTile
          label="Active configurations"
          value={configurations.data?.length}
          loading={loading}
          hint="Customer type × coverage"
          icon={<IconUsers className="size-5" />}
        />
        <StatTile
          label="Insurance options"
          value={options.data?.length}
          loading={loading}
          hint="Benefits you defined"
          icon={<IconShield className="size-5" />}
        />
      </div>

      {!loading && total === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<IconBuilding className="size-6" />}
            title="The insurance database is empty"
            description="Start by adding an insurance company. You will set up its plans, prices and benefits straight afterwards."
            action={
              <ButtonLink to={ROUTES.companies.new}>
                <IconAdd className="size-4" />
                Add your first company
              </ButtonLink>
            }
          />
        </div>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-content text-lg font-semibold">Companies</h2>
            <Link
              to={ROUTES.companies.list}
              className="text-brand-strong hover:text-brand flex items-center gap-1 text-sm font-semibold"
            >
              View all
              <IconChevronRight className="size-4" />
            </Link>
          </div>

          <Card className="divide-border-subtle divide-y overflow-hidden">
            {recent.map((company) => (
              <Link
                key={company.id}
                to={ROUTES.companies.detail(company.id)}
                className="hover:bg-surface-muted/50 flex items-center gap-3 px-5 py-4 transition-colors"
              >
                <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="sm" />
                <span className="text-content min-w-0 flex-1 truncate font-medium">
                  {company.name}
                </span>
                <IconChevronRight className="text-content-subtle size-4 shrink-0" />
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
