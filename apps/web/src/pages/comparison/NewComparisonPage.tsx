import { Button, Callout, PageHeader } from '@/components/ui';
import {
  ComparisonCriteriaForm,
  ComparisonCriteriaSummary,
  useComparisonCriteria,
} from '@/features/comparison';

/**
 * The comparison selection screen.
 *
 * Structure only: the selections are captured, validated and resolved through
 * the shared business rules. Running the comparison itself is not implemented.
 */
export function NewComparisonPage() {
  const { criteria, setField, errorsByField, isComplete, revealErrors, resolved, reset } =
    useComparisonCriteria();

  return (
    <>
      <PageHeader
        title="New comparison"
        description="Select the requirements for the comparison."
        actions={
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isComplete) {
              revealErrors();
              return;
            }
            // The comparison engine is not implemented yet.
          }}
        >
          <ComparisonCriteriaForm
            criteria={criteria}
            onChange={setField}
            errorsByField={errorsByField}
          />

          <div className="mt-10 flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={!isComplete}>
              Compare
            </Button>
          </div>

          <Callout tone="warning" className="mt-6" title="Not connected yet">
            The comparison engine and the insurance database are not implemented. Selecting criteria
            currently produces no results.
          </Callout>
        </form>

        <aside className="lg:sticky lg:top-8">
          {resolved ? (
            <ComparisonCriteriaSummary resolved={resolved} />
          ) : (
            <Callout title="Selection summary">
              Your selections will be summarised here once every requirement is chosen.
            </Callout>
          )}
        </aside>
      </div>
    </>
  );
}
