import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconAdd,
  IconBuilding,
  IconChevronRight,
  IconLayers,
  IconPlan,
  IconShield,
  StatTile,
  describeError,
} from '@/components/ui';
import { PLAN_TIER_IDS } from '@aggregator/shared';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceOptions,
  usePlans,
} from '@/features/insurance-data/insurance-data.api';

/**
 * The landing screen.
 *
 * This application exists to compare insurance plans, so that is what the page
 * leads with. The counts below are context — how much there is to compare —
 * and each links to the screen that manages it. Companies, plans and insurance
 * types are still administered from the navigation and from those tiles; they
 * are simply no longer the headline.
 */
export function DashboardPage() {
  const companies = useCompanies();
  const plans = usePlans();
  const benefits = useInsuranceOptions();

  const queries = [companies, plans, benefits];
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
    (benefits.data?.length ?? 0);

  const isEmpty = !loading && failure === undefined && allLoaded && total === 0;

  function retryAll() {
    for (const query of queries) void query.refetch();
  }

  return (
    <>
      {/* The one thing this application is for. */}
      <section className="bg-brand-gradient text-content-inverted rounded-(--radius-card) px-6 py-12 text-center shadow-(--shadow-brand) sm:px-10 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Start Comparing</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
          Compare insurance plans based on the coverage and benefits you need, then find the best
          value for your budget.
        </p>
        <div className="mt-8 flex justify-center">
          <ButtonLink to={ROUTES.comparison.new} variant="secondary" size="lg">
            Start Comparing
            <IconChevronRight className="size-4" />
          </ButtonLink>
        </div>
      </section>

      {/* Secondary: how much there is to compare. Every number comes from the
          database — nothing here is a placeholder figure. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Available plans"
          value={plans.data?.length}
          loading={loading || failure !== undefined}
          icon={<IconLayers className="size-5" />}
          to={ROUTES.plans.list}
        />
        <StatTile
          label="Benefits"
          value={benefits.data?.length}
          loading={loading || failure !== undefined}
          hint="Shared by every company"
          icon={<IconPlan className="size-5" />}
        />
        <StatTile
          label="Insurance companies"
          value={companies.data?.length}
          loading={loading || failure !== undefined}
          icon={<IconBuilding className="size-5" />}
          to={ROUTES.companies.list}
        />
        {/*
          A fixed set, not a count that grows: Basic, Standard and Premium are
          a reading of each variant's annual limit rather than records anybody
          creates. The tile leads to what the three mean.
        */}
        <StatTile
          label="Plan tiers"
          value={PLAN_TIER_IDS.length}
          loading={loading || failure !== undefined}
          icon={<IconShield className="size-5" />}
          to={ROUTES.planTiers.list}
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

      {/* Nothing to compare yet, so say what has to happen first. */}
      {isEmpty ? (
        <div className="mt-5">
          <EmptyState
            icon={<IconBuilding className="size-6" />}
            title="There is nothing to compare yet"
            description="A comparison needs insurance companies with priced plans. Add the first company to start building the database."
            action={
              <ButtonLink to={ROUTES.companies.new}>
                <IconAdd className="size-4" />
                Add your first company
              </ButtonLink>
            }
          />
        </div>
      ) : null}
    </>
  );
}
