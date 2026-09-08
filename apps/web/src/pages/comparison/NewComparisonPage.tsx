import {
  CUSTOMER_TYPES,
  DEFAULT_COMPARISON_AGE,
  PLAN_TIERS,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  describeSmeDistributionProblem,
  emptySmeEmployeeCounts,
  listEnabledOptions,
  optionLabel,
  resolveAverageAgeForCustomerType,
  totalSmeEmployees,
  usesAgeRange,
  usesFixedAverageAge,
  type ComparisonRequestInput,
  type CustomerTypeId,
  type SmeEmployeeCounts,
  type PlanTierId,
  type GeographicalCoverageId,
} from '@aggregator/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Field,
  IconChevronRight,
  IconShield,
  IconSparkle,
  Input,
  Select,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import {
  ComparisonBudgetChoice,
  ComparisonSegmented,
  SmeEmployeeAges,
  comparisonRequestParams,
  type BudgetMode,
} from '@/features/comparison';
import {
  useComparisonCurrencies,
  useComparisonPriceRange,
} from '@/features/insurance-data/insurance-data.api';

/**
 * The comparison requirements.
 *
 * ONE QUESTION MUST BE ANSWERED: who is being insured. A company's Individual,
 * Family and SME books are separate products, so "the best plan" for nobody in
 * particular is not a question with an answer. Everything else is optional —
 * left blank, the system compares at the standard age, across every coverage
 * area, in the currency most plans are priced in, with no budget ceiling —
 * and the results say what was assumed.
 *
 * So the screen offers two ways through. "Work it out for me" runs on the
 * customer type alone. "Compare Plans" runs on whatever else was filled in.
 *
 * The customer never picks benefits. Which benefits get compared is decided by
 * the plans that match, so this screen has no benefit list at all. Currencies
 * come from the database; customer types and coverage areas from the shared
 * business configuration. Nothing here is a hardcoded company, plan, benefit
 * or price.
 */
export function NewComparisonPage() {
  const navigate = useNavigate();
  const currencies = useComparisonCurrencies();

  /**
   * How good a plan has to be, read off its annual limit rather than a
   * category anybody filed it under. Optional: a customer with no view on it
   * should see every tier rather than be made to pick one.
   */
  const [planTierId, setPlanTierId] = useState<PlanTierId | null>(null);
  const [customerTypeId, setCustomerTypeId] = useState<CustomerTypeId | null>(null);
  const [coverageId, setCoverageId] = useState<GeographicalCoverageId | null>(null);
  /** What the customer typed. Ignored while the rules fix the age themselves. */
  const [typedAge, setTypedAge] = useState('');
  /** The eldest to cover, for the customer types insuring a group. */
  const [typedAgeTo, setTypedAgeTo] = useState('');
  /**
   * How many employees are in each age bracket — an SME's answer to who is
   * being insured, and what its premium is worked out from.
   */
  const [employees, setEmployees] = useState<SmeEmployeeCounts>(emptySmeEmployeeCounts);
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('AUTOMATIC');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  /**
   * Some cover is quoted against a standard age rather than a real one —
   * currently SME. That age is a business assumption about how the cover is
   * sold, NOT something the customer chose, so it is never shown and never
   * asked for: an employer offered a locked "Average age 35" would reasonably
   * read it as a claim about their own staff.
   *
   * The workforce is described by headcount instead, which is the thing the
   * broker actually has and the thing the premium is worked out from.
   *
   * Which types work that way is decided by `@aggregator/shared`, never by a
   * check for SME here.
   */
  const standardAge = customerTypeId ? resolveAverageAgeForCustomerType(customerTypeId) : null;
  const ageIsFixed =
    customerTypeId !== null && usesFixedAverageAge(customerTypeId) && standardAge?.value != null;

  /**
   * Cover for a group needs a youngest AND an eldest, because a plan only
   * qualifies if its own band spans both. Which types work that way is decided
   * by `@aggregator/shared`, never by a check for Family here.
   */
  const ageIsRange = customerTypeId !== null && usesAgeRange(customerTypeId);

  // Derived rather than stored, so switching customer type cannot leave a
  // stale figure behind and switching back hands the customer their own value.
  const age = ageIsFixed ? String(standardAge!.value) : typedAge;
  // One person is a range of one; the request always carries both ends.
  const ageTo = ageIsRange ? typedAgeTo : age;

  const availableCurrencies = currencies.data ?? [];
  const effectiveCurrency =
    currency || (availableCurrencies.length === 1 ? availableCurrencies[0]! : '');

  const ageNumber = age.trim() === '' ? null : Number(age);
  const ageToNumber = ageTo.trim() === '' ? null : Number(ageTo);

  const validAge = (value: number) =>
    Number.isInteger(value) && value >= MIN_INSURABLE_AGE && value <= MAX_INSURABLE_AGE;
  const budgetNumber = budget.trim() === '' ? null : Number(budget);

  const outOfRange = `Enter a whole age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`;

  /**
   * The workforce, where there is one. Optional: a business that has not
   * described its staff is priced per employee and told so, which is more
   * useful than being stopped at the door.
   */
  const employeeCount = totalSmeEmployees(employees);
  const employeesError = !ageIsFixed ? null : describeSmeDistributionProblem(employees);

  /**
   * A BLANK AGE IS ALLOWED; a wrong one is not. Left blank, the comparison
   * runs at the standard age and says so. Typed wrong, it says what an age is.
   */
  const ageError =
    ageIsFixed || ageNumber === null ? null : !validAge(ageNumber) ? outOfRange : null;

  const ageToError =
    !ageIsRange || ageToNumber === null
      ? null
      : !validAge(ageToNumber)
        ? outOfRange
        : ageNumber !== null && ageNumber > ageToNumber
          ? 'Age From cannot be greater than Age To.'
          : null;

  const budgetError =
    budgetMode === 'AUTOMATIC'
      ? null
      : budgetNumber === null
        ? 'Enter the amount you are comfortable paying.'
        : Number.isNaN(budgetNumber) || budgetNumber < 0
          ? 'Enter a budget of zero or more.'
          : null;

  /**
   * The requirements as answered so far — complete the moment the customer
   * type is chosen, since nothing else is required. Only what was answered is
   * sent; the API fills the rest and says what it assumed.
   */
  const request: Omit<ComparisonRequestInput, 'budget'> | null =
    customerTypeId !== null && ageError === null && ageToError === null && employeesError === null
      ? {
          ...(planTierId ? { planTierId } : {}),
          /**
           * The workforce goes with it. A budget worked out from ONE person at
           * the standard age is a fraction of what a business pays, and
           * proposing it put every plan over the ceiling.
           */
          ...(ageIsFixed && employeeCount > 0 ? { smeEmployees: employees } : {}),
          customerTypeId,
          ...(coverageId ? { geographicalCoverageId: coverageId } : {}),
          ...(effectiveCurrency ? { currency: effectiveCurrency } : {}),
          ...(ageNumber !== null ? { ageFrom: ageNumber } : {}),
          ...(ageToNumber !== null ? { ageTo: ageToNumber } : {}),
        }
      : null;

  const priceRange = useComparisonPriceRange(request);
  /** The currency the figures are in: chosen, or read off the matching plans. */
  const displayCurrency = effectiveCurrency || priceRange.data?.currency || '';

  const ready = request !== null && budgetError === null;

  // The selection travels in the URL, so a comparison can be shared and
  // survives a refresh.
  const go = (input: ComparisonRequestInput) =>
    navigate(`${ROUTES.comparison.results}?${comparisonRequestParams(input).toString()}`);

  /**
   * THE SHORT WAY. Who is being insured, and nothing else: the API applies
   * every standard assumption and the results name each one.
   */
  function workItOut() {
    if (customerTypeId === null) {
      setShowErrors(true);
      return;
    }
    go({ customerTypeId });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || request === null) {
      setShowErrors(true);
      return;
    }

    /**
     * Automatic resolves to the dearest matching plan, so nothing is excluded
     * on price. With nothing to price against, the budget is left out entirely
     * rather than invented.
     */
    const resolvedBudget =
      budgetMode === 'MANUAL' ? budgetNumber : (priceRange.data?.suggestedBudget ?? null);

    go({ ...request, ...(resolvedBudget === null ? {} : { budget: resolvedBudget }) });
  }

  const whoLabel = customerTypeId
    ? optionLabel(CUSTOMER_TYPES, customerTypeId).toLowerCase()
    : 'matching';

  return (
    <div className="w-full">
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient text-content-inverted px-6 py-8 sm:px-10 sm:py-12">
          <p className="text-sm font-medium text-white/80">Find your</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Insurance plan</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
            Compare plans from every insurance company on record and choose the best value for you
            and your family.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="px-6 py-7 sm:px-10 sm:py-9">
          {/* Where the customer is in the flow: requirements, then results. */}
          <div className="flex items-center gap-3">
            <span className="bg-brand text-content-inverted rounded-(--radius-pill) px-3 py-1 text-xs font-bold">
              1 / 2
            </span>
            <span className="text-content text-sm font-medium">Tell us about your needs</span>
          </div>
          <div className="bg-surface-muted mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-brand h-full w-1/2 rounded-full" />
          </div>

          {/* THE ONE REQUIRED ANSWER, on its own and first. */}
          <div className="mt-7">
            <ComparisonSegmented
              name="customerType"
              legend="Who do you want to insure?"
              options={listEnabledOptions(CUSTOMER_TYPES).map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              value={customerTypeId}
              onChange={(id) => setCustomerTypeId(id as CustomerTypeId)}
              error={
                showErrors && customerTypeId === null ? 'Select who you want to insure.' : null
              }
            />
          </div>

          {/*
            WORK IT OUT FOR ME. The rest of the form is optional, and this is
            the button that says so: one click, and the comparison runs on
            the standard assumptions, each of which the results will name.
          */}
          <div className="border-brand-border bg-brand-soft/60 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-(--radius-card) border p-4 sm:p-5">
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className="bg-brand text-content-inverted flex size-9 shrink-0 items-center justify-center rounded-(--radius-control)"
              >
                <IconSparkle className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-content text-sm font-semibold">
                  Not sure about the rest? Work it out for me.
                </p>
                <p className="text-content-muted mt-0.5 max-w-xl text-xs leading-relaxed">
                  We compare every {whoLabel} plan on record at the standard assumptions — age{' '}
                  {DEFAULT_COMPARISON_AGE}, any coverage area, the currency most plans are priced in
                  and no budget limit — and recommend the best value.
                </p>
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={workItOut}>
              Work it out for me
              <IconChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-3" aria-hidden="true">
            <span className="bg-border-subtle h-px flex-1" />
            <span className="text-content-subtle text-xs font-semibold tracking-wide uppercase">
              Or tell us more — every question below is optional
            </span>
            <span className="bg-border-subtle h-px flex-1" />
          </div>

          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            {/*
              HOW GOOD A PLAN HAS TO BE, read off its annual limit rather than
              a category anybody filed it under. An "Any" pill, chosen by
              default, and picking a tier again clears it.
            */}
            <div className="lg:col-span-2">
              <ComparisonSegmented
                name="planTier"
                legend="How much cover?"
                options={listEnabledOptions(PLAN_TIERS).map((tier) => ({
                  id: tier.id,
                  label: tier.label,
                  description: tier.description,
                }))}
                value={planTierId}
                onChange={(id) => setPlanTierId(id as PlanTierId)}
                onClear={() => setPlanTierId(null)}
                noneLabel="Any"
                error={null}
              />
            </div>

            {/* Where the cover applies. "Any" compares every scope on sale. */}
            <ComparisonSegmented
              name="geographicalCoverage"
              legend="Geographical coverage"
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

            {/*
              The currency the figures are in. Left blank, the comparison runs
              in whichever one most of the matching plans are priced in, and
              the budget card below says which.
            */}
            <Field
              label="Currency"
              hint={
                !effectiveCurrency && priceRange.data?.currencyAssumed && priceRange.data.currency
                  ? `Left blank: plans are priced in ${priceRange.data.currency}, which most of them use.`
                  : 'Left blank, the currency most matching plans use is chosen for you.'
              }
            >
              {(props) => (
                <Select
                  {...props}
                  value={effectiveCurrency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option value="">Any — work it out from the plans</option>
                  {availableCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {/*
              A BUSINESS IS ASKED FOR ITS WORKFORCE, everybody else for an age.

              The standard comparison age still applies to an SME — it is what
              decides which plans are sold to them — but it is the system's
              assumption rather than the employer's answer, so it is not on the
              form at all. What the employer is asked for is the headcount per
              age group, which is what actually prices the cover.
            */}
            {ageIsFixed ? (
              <div className="lg:col-span-2">
                <SmeEmployeeAges
                  counts={employees}
                  onChange={setEmployees}
                  error={showErrors && employeesError ? employeesError : null}
                />
              </div>
            ) : (
              <div className={cn('lg:col-span-2', ageIsRange && 'grid gap-4 sm:grid-cols-2')}>
                <Field
                  label={ageIsRange ? 'Age from' : 'Age'}
                  hint={
                    ageIsRange
                      ? `Left blank, the family is compared at age ${DEFAULT_COMPARISON_AGE}.`
                      : `Left blank, plans are priced at age ${DEFAULT_COMPARISON_AGE}.`
                  }
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
                      value={age}
                      onChange={(event) => setTypedAge(event.target.value)}
                      placeholder={ageIsRange ? '4' : String(DEFAULT_COMPARISON_AGE)}
                    />
                  )}
                </Field>

                {/* The eldest to cover. A plan qualifies only when its own band
                  reaches both ends of this range. */}
                {ageIsRange ? (
                  <Field
                    label="Age to"
                    hint="The eldest to cover. Left blank, the same as the youngest."
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

            {/* Last, and full width: it is worked out from everything above. */}
            <div className="lg:col-span-2">
              <ComparisonBudgetChoice
                mode={budgetMode}
                onModeChange={setBudgetMode}
                budget={budget}
                onBudgetChange={setBudget}
                priceRange={request ? (priceRange.data ?? null) : null}
                isLoadingRange={request !== null && priceRange.isLoading}
                currency={displayCurrency}
                error={showErrors && budgetError ? budgetError : null}
              />
            </div>
          </div>

          <Button type="submit" size="lg" fullWidth className="mt-8">
            Compare Plans
            <IconChevronRight className="size-4" />
          </Button>

          <p className="text-content-subtle mt-4 flex items-center justify-center gap-2 text-xs">
            <IconShield className="size-4" />
            We compare every plan in your database — benefits are found for you.
          </p>
        </form>
      </Card>
    </div>
  );
}
