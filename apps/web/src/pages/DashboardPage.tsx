import { Link } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  Card,
  CompanyLogo,
  EmptyState,
  IconAdd,
  IconBuilding,
  IconChevronRight,
  IconLayers,
  IconShield,
  PageHeader,
  StatTile,
  describeError,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceTypes,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';

/**
 * A high-level read of what has been entered so far, and a way straight into
 * the work. Every number comes from the database; nothing is invented.
 */
export function DashboardPage() {
  const companies = useCompanies();
  const plans = usePlans();
  const insuranceTypes = useInsuranceTypes();

  const queries = [companies, plans, insuranceTypes];
  const loading = queries.some((query) => query.isLoading);

  /**
   * A failed request is NOT an empty database. Without this the counts fall
   * back to zero and the screen wrongly announces that nothing has been
   * entered — which is indistinguishable from real data loss to whoever is
   * looking at it.
   */
  const failure = queries.find((query) => query.error)?.error;
  const allLoaded = queries.every((query) => query.data !== undefined);

  const total =
    (companies.data?.length ?? 0) +
    (plans.data?.length ?? 0) +
    (insuranceTypes.data?.length ?? 0);

  const recent = (companies.data ?? []).slice(0, 5);

  function retryAll() {
    for (const query of queries) void query.refetch();
  }

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
          loading={loading || failure !== undefined}
          icon={<IconBuilding className="size-5" />}
        />
        <StatTile
          label="Plans"
          value={plans.data?.length}
          loading={loading || failure !== undefined}
          icon={<IconLayers className="size-5" />}
        />
        <StatTile
          label="Insurance types"
          value={insuranceTypes.data?.length}
          loading={loading || failure !== undefined}
          hint="Categories you defined"
          icon={<IconShield className="size-5" />}
        />
      </div>

      {failure !== undefined ? (
        <div className="mt-5">
          <Card className="px-6 py-12 text-center">
            <h2 className="text-content text-base font-semibold">Could not load the overview</h2>
            <p className="text-content-muted mx-auto mt-2 max-w-md text-sm">
              {describeError(failure, 'the overview')}
            </p>
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={retryAll}>
                Try again
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && failure === undefined && allLoaded && total === 0 ? (
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
