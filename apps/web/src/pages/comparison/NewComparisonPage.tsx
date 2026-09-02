import {
  CUSTOMER_TYPES,
  PLAN_TIERS,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  describeSmeDistributionProblem,
  emptySmeEmployeeCounts,
  listEnabledOptions,
  resolveAverageAgeForCustomerType,
  totalSmeEmployees,
  usesAgeRange,
  usesFixedAverageAge,
  type CustomerTypeId,
  type SmeEmployeeCounts,
  type PlanTierId,
  type GeographicalCoverageId,
} from '@aggregator/shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Field,
  IconChevronRight,
  IconShield,
  Input,
  Select,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import {
  ComparisonBudgetChoice,
  ComparisonSegmented,
  SmeEmployeeAges,
  type BudgetMode,
} from '@/features/comparison';
import {
  useComparisonCurrencies,
  useComparisonPriceRange,
} from '@/features/insurance-data/insurance-data.api';

/**
 * The comparison requirements.
 *
 * The customer states WHO they are and WHAT THEY CAN SPEND; they never pick
 * benefits. Which benefits get compared is decided by the plans that match, so
 * this screen has no benefit list at all.
 *
 * Insurance types and currencies come from the database. Customer types and
 * coverage areas come from the shared business configuration. Nothing here is
 * a hardcoded company, plan, benefit or price.
 */
export function NewComparisonPage() {
  const navigate = useNavigate();
  const currencies = useComparisonCurrencies();

  /**
   * How good a plan has to be, read off its annual limit rather than a
   * category anybody filed it under. Optional on purpose: a customer with no
   * view on it should see every tier rather than be made to pick one.
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

  const validAge = (value: number | null) =>
    value !== null &&
    Number.isInteger(value) &&
    value >= MIN_INSURABLE_AGE &&
    value <= MAX_INSURABLE_AGE;
  const budgetNumber = budget.trim() === '' ? null : Number(budget);

  const outOfRange = `Enter a whole age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`;

  /**
   * The workforce, where there is one. A comparison of nobody prices nothing,
   * so at least one employee is what makes the question answered.
   */
  const employeeCount = totalSmeEmployees(employees);
  const employeesError = !ageIsFixed
    ? null
    : (describeSmeDistributionProblem(employees) ??
      (employeeCount === 0 ? 'Enter how many employees are in each age group.' : null));

  const ageError = ageIsFixed
    ? null
    : ageNumber === null
      ? ageIsRange
        ? 'Enter the age of the youngest to cover.'
        : 'Enter the age of the person being insured.'
      : !validAge(ageNumber)
        ? outOfRange
        : null;

  const ageToError = !ageIsRange
    ? null
    : ageToNumber === null
      ? 'Enter the age of the eldest to cover.'
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
   * The requirements the budget is worked out from — complete only once every
   * question above it has an answer, which is why the budget sits last.
   */
  const priceRangeRequest =
    customerTypeId !== null &&
    coverageId !== null &&
    effectiveCurrency !== '' &&
    ageError === null &&
    ageToError === null &&
    employeesError === null
      ? {
          ...(planTierId ? { planTierId } : {}),
          /**
           * The workforce goes with it. A budget worked out from ONE person at
           * the standard age is a fraction of what a business pays, and
           * proposing it put every plan over the ceiling.
           */
          ...(ageIsFixed && employeeCount > 0 ? { smeEmployees: employees } : {}),
          customerTypeId,
          geographicalCoverageId: coverageId,
          currency: effectiveCurrency,
          ageFrom: ageNumber!,
          ageTo: ageToNumber!,
        }
      : null;

  const priceRange = useComparisonPriceRange(priceRangeRequest);

  const ready =
    customerTypeId !== null &&
    coverageId !== null &&
    effectiveCurrency !== '' &&
    ageError === null &&
    ageToError === null &&
    employeesError === null &&
    budgetError === null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) {
      setShowErrors(true);
      return;
    }

    // The selection travels in the URL, so a comparison can be shared and
    // survives a refresh.
    /**
     * Automatic resolves to the dearest matching plan, so nothing is excluded
     * on price. With nothing to price against, the budget is left out entirely
     * rather than invented.
     */
    const resolvedBudget =
      budgetMode === 'MANUAL' ? budgetNumber : (priceRange.data?.suggestedBudget ?? null);

    const params = new URLSearchParams({
      ...(planTierId ? { planTierId } : {}),
      customerTypeId: customerTypeId!,
      geographicalCoverageId: coverageId!,
      currency: effectiveCurrency,
      ageFrom: String(ageNumber),
      ageTo: String(ageToNumber),
      ...(resolvedBudget === null ? {} : { budget: String(resolvedBudget) }),
    });

    /**
     * The workforce travels as one parameter per occupied bracket, so the URL
     * stays readable and a comparison of twenty people is still a link that can
     * be sent to somebody. Empty brackets are left out: nobody being 55–59 is
     * the default, and writing eleven zeroes down says no more than omitting
     * them.
     */
    for (const [bracketId, count] of Object.entries(employees)) {
      if (count > 0) params.append('employees', `${bracketId}:${count}`);
    }
    navigate(`${ROUTES.comparison.results}?${params.toString()}`);
  }

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

          <div className="mt-7 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            {/*
              HOW GOOD A PLAN HAS TO BE, read off its annual limit rather than
              a category anybody filed it under.

              Optional, and the only optional question on this form: a customer
              who has not decided should see every tier rather than be made to
              rule two of them out before they know what they cost. Picking one
              again clears it.
            */}
            <div className="lg:col-span-2">
              <ComparisonSegmented
                name="planTier"
                legend="How much cover? (optional)"
                options={listEnabledOptions(PLAN_TIERS).map((tier) => ({
                  id: tier.id,
                  label: tier.label,
                  description: tier.description,
                }))}
                value={planTierId}
                onChange={(id) => setPlanTierId((current) => (current === id ? null : (id as PlanTierId)))}
                error={null}
              />
            </div>

            {/* Paired with the coverage area: both are short pill rows. */}
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

            {/* ONE age. The admin's configurations declare a band; this is the
                single number matched against it. */}
            <ComparisonSegmented
              name="geographicalCoverage"
              legend="Geographical coverage"
              options={listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              value={coverageId}
              onChange={(id) => setCoverageId(id as GeographicalCoverageId)}
              error={showErrors && coverageId === null ? 'Select a coverage area.' : null}
            />

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
            <div className={cn(ageIsRange && 'grid gap-4 sm:grid-cols-2')}>
              <Field
                label={ageIsRange ? 'Age from' : 'Age'}
                required
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
                    placeholder={ageIsRange ? '4' : '35'}
                  />
                )}
              </Field>

              {/* The eldest to cover. A plan qualifies only when its own band
                  reaches both ends of this range. */}
              {ageIsRange ? (
                <Field
                  label="Age to"
                  required
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

            <Field
              label="Currency"
              required
              error={showErrors && effectiveCurrency === '' ? 'Select a currency.' : undefined}
            >
              {(props) => (
                <Select
                  {...props}
                  value={effectiveCurrency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option value="">Select a currency…</option>
                  {availableCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {/* Last, and full width: it is worked out from everything above. */}
            <div className="lg:col-span-2">
              <ComparisonBudgetChoice
                mode={budgetMode}
                onModeChange={setBudgetMode}
                budget={budget}
                onBudgetChange={setBudget}
                priceRange={priceRangeRequest ? (priceRange.data ?? null) : null}
                isLoadingRange={priceRangeRequest !== null && priceRange.isLoading}
                currency={effectiveCurrency}
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
