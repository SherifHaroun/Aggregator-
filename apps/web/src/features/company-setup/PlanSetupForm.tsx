import { useState } from 'react';
import {
  CUSTOMER_TYPE_IDS,
  GEOGRAPHICAL_COVERAGE_IDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  coverageLabel,
  customerTypeLabel,
  derivePlanCode,
  type CustomerTypeId,
  type GeographicalCoverageId,
} from '@aggregator/shared';
import {
  Button,
  Callout,
  Field,
  IconAdd,
  Input,
  NumberInput,
  Select,
  useToast,
} from '@/components/ui';
import {
  useInsuranceTypes,
  useMedicalNetworks,
  useSaveInsuranceType,
  useSavePlan,
  useSavePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/** Sentinel for the "create a new insurance type" choice in the select. */
const NEW_TYPE = '__new__';

const EMPTY = {
  name: '',
  insuranceTypeId: '',
  newTypeName: '',
  medicalNetworkId: '',
  customerType: 'INDIVIDUAL' as CustomerTypeId,
  geographicalCoverage: 'LOCAL' as GeographicalCoverageId,
  ageFrom: '',
  ageTo: '',
  currency: '',
  annualPrice: '',
  annualLimit: '',
  deductible: '',
  coPayment: '',
};

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

/**
 * One form that creates a plan and its first priced configuration together.
 *
 * The employee thinks in terms of "a plan with a price". The database keeps the
 * product (`Plan`) separate from its priced variant (`PlanConfiguration`) so the
 * same plan can carry different prices per customer type and coverage area.
 * This form hides that split without collapsing it — further configurations are
 * added later from the plan's own screen.
 */
export function PlanSetupForm({
  companyId,
  onCreated,
}: {
  companyId: string;
  onCreated: (planName: string) => void;
}) {
  const { notify } = useToast();
  const insuranceTypes = useInsuranceTypes({ isActive: true });
  // Only THIS company's networks. Another insurer's list is not on offer here.
  const networks = useMedicalNetworks(companyId);
  const saveType = useSaveInsuranceType();
  const savePlan = useSavePlan();
  const saveConfiguration = useSavePlanConfiguration();

  const { values, setValue, reset, fieldErrors, formError, applyError } = useRecordForm(EMPTY);

  const creatingType = values.insuranceTypeId === NEW_TYPE;
  const pending = saveType.isPending || savePlan.isPending || saveConfiguration.isPending;

  const [ageError, setAgeError] = useState<{ field: 'ageFrom' | 'ageTo'; message: string } | null>(
    null,
  );

  /**
   * Checked here so the employee sees the problem next to the field. The API
   * validates the band again and remains the authority.
   */
  function ageBandIssue(): { field: 'ageFrom' | 'ageTo'; message: string } | null {
    const from = toNumber(values.ageFrom);
    const to = toNumber(values.ageTo);
    if (from === null) return { field: 'ageFrom', message: 'Age From is required.' };
    if (to === null) return { field: 'ageTo', message: 'Age To is required.' };
    if (!Number.isInteger(from)) {
      return { field: 'ageFrom', message: 'Enter a whole number of years.' };
    }
    if (!Number.isInteger(to)) return { field: 'ageTo', message: 'Enter a whole number of years.' };
    if (from < MIN_INSURABLE_AGE || from > MAX_INSURABLE_AGE) {
      return {
        field: 'ageFrom',
        message: `Enter an age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`,
      };
    }
    if (to < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE) {
      return {
        field: 'ageTo',
        message: `Enter an age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`,
      };
    }
    if (from > to) return { field: 'ageFrom', message: 'Age From cannot be greater than Age To.' };
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const issue = ageBandIssue();
    setAgeError(issue);
    if (issue) return;

    // A brand-new insurance type is created first, then the plan points at it.
    let insuranceTypeId = values.insuranceTypeId;
    if (creatingType) {
      try {
        insuranceTypeId = (await saveType.mutateAsync({ name: values.newTypeName.trim() })).id;
      } catch (error) {
        applyError(error, 'the insurance type');
        return;
      }
    }

    try {
      const plan = await savePlan.mutateAsync({
        companyId,
        insuranceTypeId,
        name: values.name.trim(),
        code: derivePlanCode(values.name),
        // Empty means the document does not say — never an invented network.
        medicalNetworkId: values.medicalNetworkId === '' ? null : values.medicalNetworkId,
        isActive: true,
      });

      await saveConfiguration.mutateAsync({
        planId: plan.id,
        customerType: values.customerType,
        geographicalCoverage: values.geographicalCoverage,
        ageFrom: toNumber(values.ageFrom),
        ageTo: toNumber(values.ageTo),
        currency: values.currency.trim() === '' ? null : values.currency.trim(),
        annualPrice: toNumber(values.annualPrice),
        annualLimit: toNumber(values.annualLimit),
        deductible: toNumber(values.deductible),
        coPayment: toNumber(values.coPayment),
        isActive: true,
      });

      notify(`${plan.name} was added.`);
      onCreated(plan.name);

      // Keep type, coverage and currency so the next plan is quick to enter.
      reset({
        ...EMPTY,
        insuranceTypeId,
        customerType: values.customerType,
        geographicalCoverage: values.geographicalCoverage,
        currency: values.currency,
      });
    } catch (error) {
      applyError(error, 'the plan');
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError ? (
        <Callout tone="danger" title="Could not add the plan">
          {formError}
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name" required error={fieldErrors.name}>
          {(props) => (
            <Input
              {...props}
              value={values.name}
              onChange={(event) => setValue('name', event.target.value)}
              placeholder="Name this plan"
            />
          )}
        </Field>

        <Field
          label="Insurance type"
          required
          error={fieldErrors.insuranceTypeId}
          hint="Groups plans and the benefits available to them."
        >
          {(props) => (
            <Select
              {...props}
              value={values.insuranceTypeId}
              onChange={(event) => setValue('insuranceTypeId', event.target.value)}
            >
              <option value="">Select an insurance type</option>
              {(insuranceTypes.data ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
              <option value={NEW_TYPE}>+ Create a new insurance type…</option>
            </Select>
          )}
        </Field>

        {creatingType ? (
          <div className="sm:col-span-2">
            <Field label="New insurance type name" required error={fieldErrors.newTypeName}>
              {(props) => (
                <Input
                  {...props}
                  value={values.newTypeName}
                  onChange={(event) => setValue('newTypeName', event.target.value)}
                  placeholder="Name this category of insurance"
                />
              )}
            </Field>
          </div>
        ) : null}

        {/* Chosen from the company's own list, never typed: a network is the
            company's, and a name invented here would belong to nothing. */}
        <Field
          label="Medical network"
          error={fieldErrors.medicalNetworkId}
          hint={
            (networks.data?.length ?? 0) === 0
              ? 'This company has no networks yet. Add them on the company screen.'
              : 'Leave blank where the document does not say.'
          }
        >
          {(props) => (
            <Select
              {...props}
              value={values.medicalNetworkId}
              disabled={(networks.data?.length ?? 0) === 0}
              onChange={(event) => setValue('medicalNetworkId', event.target.value)}
            >
              <option value="">Not stated</option>
              {(networks.data ?? []).map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Customer type" required error={fieldErrors.customerType}>
          {(props) => (
            <Select
              {...props}
              value={values.customerType}
              onChange={(event) => setValue('customerType', event.target.value as CustomerTypeId)}
            >
              {CUSTOMER_TYPE_IDS.map((id) => (
                <option key={id} value={id}>
                  {customerTypeLabel(id)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Geographical coverage" required error={fieldErrors.geographicalCoverage}>
          {(props) => (
            <Select
              {...props}
              value={values.geographicalCoverage}
              onChange={(event) =>
                setValue('geographicalCoverage', event.target.value as GeographicalCoverageId)
              }
            >
              {GEOGRAPHICAL_COVERAGE_IDS.map((id) => (
                <option key={id} value={id}>
                  {coverageLabel(id)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* Who this configuration is for, by age. Required: a configuration
            nobody's age falls into can never be matched by a comparison. */}
        <Field
          label="Age from"
          required
          error={ageError?.field === 'ageFrom' ? ageError.message : fieldErrors.ageFrom}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              min={MIN_INSURABLE_AGE}
              max={MAX_INSURABLE_AGE}
              step={1}
              value={values.ageFrom}
              onChange={(event) => {
                setAgeError(null);
                setValue('ageFrom', event.target.value);
              }}
              placeholder="18"
            />
          )}
        </Field>

        <Field
          label="Age to"
          required
          error={ageError?.field === 'ageTo' ? ageError.message : fieldErrors.ageTo}
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              min={MIN_INSURABLE_AGE}
              max={MAX_INSURABLE_AGE}
              step={1}
              value={values.ageTo}
              onChange={(event) => {
                setAgeError(null);
                setValue('ageTo', event.target.value);
              }}
              placeholder="60"
            />
          )}
        </Field>

        <Field label="Currency" error={fieldErrors.currency} hint="Three-letter code.">
          {(props) => (
            <Input
              {...props}
              maxLength={3}
              value={values.currency}
              onChange={(event) => setValue('currency', event.target.value.toUpperCase())}
              placeholder="EGP"
            />
          )}
        </Field>

        {/* Every figure is grouped as it is typed, and left blank when the
            plan does not state one. */}
        <Field label="Annual price" error={fieldErrors.annualPrice}>
          {(props) => (
            <NumberInput
              {...props}
              suffix={values.currency || ''}
              value={values.annualPrice}
              onChange={(next) => setValue('annualPrice', next)}
            />
          )}
        </Field>

        <Field
          label="Annual limit"
          error={fieldErrors.annualLimit}
          hint="Leave blank if the plan does not state one."
        >
          {(props) => (
            <NumberInput
              {...props}
              suffix={values.currency || ''}
              value={values.annualLimit}
              onChange={(next) => setValue('annualLimit', next)}
            />
          )}
        </Field>

        <Field
          label="Deductible"
          error={fieldErrors.deductible}
          hint="An amount, not a percentage. Leave blank if the plan does not state one."
        >
          {(props) => (
            <NumberInput
              {...props}
              suffix={values.currency || ''}
              value={values.deductible}
              onChange={(next) => setValue('deductible', next)}
            />
          )}
        </Field>

        <Field
          label="Co-payment"
          error={fieldErrors.coPayment}
          hint="Leave blank if the plan does not state one."
        >
          {(props) => (
            <NumberInput
              {...props}
              suffix="%"
              value={values.coPayment}
              onChange={(next) => setValue('coPayment', next)}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <IconAdd className="size-4" />
          {pending ? 'Adding…' : 'Add plan'}
        </Button>
      </div>
    </form>
  );
}
