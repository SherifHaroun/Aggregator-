import {
  CUSTOMER_TYPE_IDS,
  GEOGRAPHICAL_COVERAGE_IDS,
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
  InputWithSuffix,
  Select,
  useToast,
} from '@/components/ui';
import {
  useInsuranceTypes,
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
  customerType: 'INDIVIDUAL' as CustomerTypeId,
  geographicalCoverage: 'LOCAL' as GeographicalCoverageId,
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
  const saveType = useSaveInsuranceType();
  const savePlan = useSavePlan();
  const saveConfiguration = useSavePlanConfiguration();

  const { values, setValue, reset, fieldErrors, formError, applyError } = useRecordForm(EMPTY);

  const creatingType = values.insuranceTypeId === NEW_TYPE;
  const pending = saveType.isPending || savePlan.isPending || saveConfiguration.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();

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
        isActive: true,
      });

      await saveConfiguration.mutateAsync({
        planId: plan.id,
        customerType: values.customerType,
        geographicalCoverage: values.geographicalCoverage,
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

        <Field label="Annual price" error={fieldErrors.annualPrice}>
          {(props) => (
            <InputWithSuffix
              {...props}
              type="number"
              min={0}
              step="0.01"
              suffix={values.currency || ''}
              value={values.annualPrice}
              onChange={(event) => setValue('annualPrice', event.target.value)}
            />
          )}
        </Field>

        <Field label="Annual limit" error={fieldErrors.annualLimit}>
          {(props) => (
            <InputWithSuffix
              {...props}
              type="number"
              min={0}
              step="0.01"
              suffix={values.currency || ''}
              value={values.annualLimit}
              onChange={(event) => setValue('annualLimit', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Deductible"
          error={fieldErrors.deductible}
          hint="An amount, not a percentage."
        >
          {(props) => (
            <InputWithSuffix
              {...props}
              type="number"
              min={0}
              step="0.01"
              suffix={values.currency || ''}
              value={values.deductible}
              onChange={(event) => setValue('deductible', event.target.value)}
            />
          )}
        </Field>

        <Field label="Co-payment" error={fieldErrors.coPayment}>
          {(props) => (
            <InputWithSuffix
              {...props}
              type="number"
              min={0}
              max={100}
              step="0.01"
              suffix="%"
              value={values.coPayment}
              onChange={(event) => setValue('coPayment', event.target.value)}
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
