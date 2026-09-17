import {
  CUSTOMER_TYPES,
  DEFAULT_COMPARISON_AGE,
  DEFAULT_CUSTOMER_TYPE_ID,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  describeSmeDistributionProblem,
  emptySmeEmployeeCounts,
  listAllOptions,
  listEnabledOptions,
  totalSmeEmployees,
  usesAgeRange,
  usesFixedAverageAge,
  type ComparisonRequestInput,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type SmeEmployeeCounts,
} from '@aggregator/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, IconChevronRight, Input } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  ComparisonSegmented,
  SmeEmployeeAges,
  comparisonRequestParams,
} from '@/features/comparison';
import { cn } from '@/lib/cn';

/**
 * THE COMPARE CARD ON THE HOME PAGE.
 *
 * Three questions, all a visitor needs: who is being insured, how old (or,
 * for a business, how many people in each age group), and where the cover
 * should apply. The same shared rules the employee's form uses decide which
 * questions appear — an SME is asked for a workforce, a family for the
 * youngest and eldest — and the answers travel on in the URL exactly as the
 * admin's do, so both sites run one engine.
 *
 * WHO IS ON SALE is the shared registry's call: a customer type switched
 * off there is still drawn, greyed and marked "coming soon", so a visitor
 * sees the line is on its way rather than wondering why it is missing.
 *
 * The card does not lead to the results directly. It leads to ONE FINAL
 * STEP — the visitor's name and how to reach them — and the results follow.
 */
export function QuickCompareForm({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [customerTypeId, setCustomerTypeId] = useState<CustomerTypeId>(DEFAULT_CUSTOMER_TYPE_ID);
  const [coverageId, setCoverageId] = useState<GeographicalCoverageId | null>(null);
  const [typedAge, setTypedAge] = useState('');
  const [typedAgeTo, setTypedAgeTo] = useState('');
  const [employees, setEmployees] = useState<SmeEmployeeCounts>(emptySmeEmployeeCounts);
  const [showErrors, setShowErrors] = useState(false);

  const ageIsFixed = usesFixedAverageAge(customerTypeId);
  const ageIsRange = usesAgeRange(customerTypeId);

  const ageNumber = typedAge.trim() === '' ? null : Number(typedAge);
  const ageToNumber = typedAgeTo.trim() === '' ? null : Number(typedAgeTo);
  const validAge = (value: number) =>
    Number.isInteger(value) && value >= MIN_INSURABLE_AGE && value <= MAX_INSURABLE_AGE;
  const outOfRange = `Enter a whole age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`;

  const ageError =
    ageIsFixed || ageNumber === null ? null : !validAge(ageNumber) ? outOfRange : null;
  const ageToError =
    !ageIsRange || ageToNumber === null
      ? null
      : !validAge(ageToNumber)
        ? outOfRange
        : ageNumber !== null && ageNumber > ageToNumber
          ? 'Age from cannot be greater than age to.'
          : null;
  const employeesError = ageIsFixed ? describeSmeDistributionProblem(employees) : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (ageError || ageToError || employeesError) {
      setShowErrors(true);
      return;
    }
    const request: ComparisonRequestInput = {
      customerTypeId,
      ...(coverageId ? { geographicalCoverageId: coverageId } : {}),
      ...(ageIsFixed && totalSmeEmployees(employees) > 0 ? { smeEmployees: employees } : {}),
      ...(!ageIsFixed && ageNumber !== null ? { ageFrom: ageNumber } : {}),
      ...(!ageIsFixed && (ageIsRange ? ageToNumber : ageNumber) !== null
        ? { ageTo: (ageIsRange ? ageToNumber : ageNumber) as number }
        : {}),
    };
    navigate(`${ROUTES.public.details}?${comparisonRequestParams(request).toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn(
        'bg-surface rounded-(--radius-card) p-5 shadow-(--shadow-raised) sm:p-7',
        className,
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-brand text-content-inverted rounded-(--radius-pill) px-3 py-1 text-xs font-bold">
          1 / 3
        </span>
        <span className="text-content text-sm font-medium">Tell us what you need</span>
      </div>

      <ComparisonSegmented
        name="publicCustomerType"
        legend="Who do you want to insure?"
        options={listAllOptions(CUSTOMER_TYPES).map((option) => ({
          id: option.id,
          label: option.label,
          disabled: !option.enabled,
        }))}
        value={customerTypeId}
        onChange={(id) => setCustomerTypeId(id as CustomerTypeId)}
        error={null}
      />

      <div className="mt-5 space-y-5">
        {ageIsFixed ? (
          <SmeEmployeeAges
            counts={employees}
            onChange={setEmployees}
            error={showErrors && employeesError ? employeesError : null}
          />
        ) : (
          <div className={cn(ageIsRange && 'grid gap-4 sm:grid-cols-2')}>
            <Field
              label={ageIsRange ? 'Age from' : 'Your age'}
              hint={`Leave blank to see prices at age ${DEFAULT_COMPARISON_AGE}.`}
              error={showErrors && ageError ? ageError : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={MIN_INSURABLE_AGE}
                  max={MAX_INSURABLE_AGE}
                  step={1}
                  value={typedAge}
                  onChange={(event) => setTypedAge(event.target.value)}
                  placeholder={ageIsRange ? '4' : String(DEFAULT_COMPARISON_AGE)}
                />
              )}
            </Field>
            {ageIsRange ? (
              <Field
                label="Age to"
                hint="The eldest to cover."
                error={showErrors && ageToError ? ageToError : undefined}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={MIN_INSURABLE_AGE}
                    max={MAX_INSURABLE_AGE}
                    step={1}
                    value={typedAgeTo}
                    onChange={(event) => setTypedAgeTo(event.target.value)}
                    placeholder="52"
                  />
                )}
              </Field>
            ) : null}
          </div>
        )}

        <ComparisonSegmented
          name="publicCoverage"
          legend="Where should the cover apply?"
          options={listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => ({
            id: option.id,
            label: option.label,
          }))}
          value={coverageId}
          onChange={(id) => setCoverageId(id as GeographicalCoverageId)}
          onClear={() => setCoverageId(null)}
          noneLabel="Any"
          error={null}
        />
      </div>

      <Button type="submit" size="lg" fullWidth className="mt-7 tracking-wide uppercase">
        Compare
        <IconChevronRight className="size-4" />
      </Button>
      <p className="text-content-subtle mt-3 text-center text-xs">
        Instant quotes from every insurer we work with. No account needed.
      </p>
    </form>
  );
}
