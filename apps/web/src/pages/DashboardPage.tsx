import { Link } from 'react-router-dom';
import { ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceOptions,
  useInsuranceTypes,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';

/**
 * Counts of what the employee has entered so far, and where to go next.
 * Nothing is invented — every number comes from the database.
 */
export function DashboardPage() {
  const companies = useCompanies();
  const insuranceTypes = useInsuranceTypes();
  const plans = usePlans();
  const options = useInsuranceOptions();

  const tiles = [
    { label: 'Companies', count: companies.data?.length, to: ROUTES.companies.list },
    { label: 'Insurance types', count: insuranceTypes.data?.length, to: ROUTES.insuranceTypes.list },
    { label: 'Plans', count: plans.data?.length, to: ROUTES.plans.list },
    { label: 'Insurance options', count: options.data?.length, to: ROUTES.insuranceOptions.list },
  ];

  const total = tiles.reduce((sum, tile) => sum + (tile.count ?? 0), 0);
  const loading = companies.isLoading || insuranceTypes.isLoading || plans.isLoading || options.isLoading;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Internal workspace for managing insurance data and running comparisons."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="block">
            <Card className="hover:border-border-strong p-5 transition-colors">
              <p className="text-content-muted text-sm">{tile.label}</p>
              <p className="text-content mt-2 text-3xl font-semibold">
                {loading ? '—' : (tile.count ?? 0)}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && total === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="The insurance database is empty"
            description="Start by adding an insurance company and an insurance type. Plans, benefits and prices build on top of those."
            action={<ButtonLink to={ROUTES.companies.new}>+ Add company</ButtonLink>}
          />
        </div>
      ) : null}
    </>
  );
}
