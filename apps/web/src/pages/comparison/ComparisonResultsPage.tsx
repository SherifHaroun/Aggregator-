import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';

/** Placeholder. The comparison engine and results layout are not implemented. */
export function ComparisonResultsPage() {
  return (
    <>
      <PageHeader title="Comparison results" />
      <EmptyState
        title="Not implemented yet"
        description="Results will be generated from the insurance data stored in the database."
        action={<ButtonLink to={ROUTES.comparison.new}>Back to selection</ButtonLink>}
      />
    </>
  );
}
