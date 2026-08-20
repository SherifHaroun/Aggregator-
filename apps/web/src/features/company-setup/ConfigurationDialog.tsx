import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  listEnabledOptions,
  resolveAverageAgeForCustomerType,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type PlanConfigurationDto,
} from '@aggregator/shared';
import { useState } from 'react';
import {
  Button,
  Callout,
  ChoiceGroup,
  Dialog,
  Field,
  IconUsers,
  Input,
  InputWithSuffix,
  StatusToggle,
  useToast,
} from '@/components/ui';
import { useSavePlanConfiguration } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

/**
 * Create or edit one configuration of a plan — a price for a specific customer
 * type and coverage area.
 *
 * Customer types and coverage options are read from the shared business
 * configuration, so this dialog never names them itself.
 */
export function ConfigurationDialog({
  planId,
  configuration,
  onClose,
}: {
  planId: string;
  /** `null` creates a new configuration. */
  configuration: PlanConfigurationDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const save = useSavePlanConfiguration(configuration?.id);

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    customerType: (configuration?.customerType ?? null) as CustomerTypeId | null,
    geographicalCoverage: (configuration?.geographicalCoverage ??
      null) as GeographicalCoverageId | null,
    ageFrom: configuration?.ageFrom?.toString() ?? '',
    ageTo: configuration?.ageTo?.toString() ?? '',
    currency: configuration?.currency ?? '',
    annualPrice: configuration?.annualPrice?.toString() ?? '',
    annualLimit: configuration?.annualLimit?.toString() ?? '',
    deductible: configuration?.deductible?.toString() ?? '',
    coPayment: configuration?.coPayment?.toString() ?? '',
    isActive: configuration?.isActive ?? true,
  });

  /**
   * The age that applies to the chosen customer type, from the centralized
   * business rule. The employee never types it and the number appears nowhere
   * in this file.
   */
  const resolvedAge = values.customerType
    ? resolveAverageAgeForCustomerType(values.customerType)
    : null;

  /**
   * The age band is checked here so the employee sees the problem next to the
   * field. The API validates it again and remains the authority.
   */
  const ageFrom = values.ageFrom.trim() === '' ? null : Number(values.ageFrom);
  const ageTo = values.ageTo.trim() === '' ? null : Number(values.ageTo);

  function ageBandIssue(): { field: 'ageFrom' | 'ageTo'; message: string } | null {
    if (ageFrom === null) return { field: 'ageFrom', message: 'Age From is required.' };
    if (ageTo === null) return { field: 'ageTo', message: 'Age To is required.' };
    if (!Number.isInteger(ageFrom)) {
      return { field: 'ageFrom', message: 'Enter a whole number of years.' };
    }
    if (!Number.isInteger(ageTo)) {
      return { field: 'ageTo', message: 'Enter a whole number of years.' };
    }
    if (ageFrom < MIN_INSURABLE_AGE || ageFrom > MAX_INSURABLE_AGE) {
      return {
        field: 'ageFrom',
        message: `Enter an age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`,
      };
    }
    if (ageTo < MIN_INSURABLE_AGE || ageTo > MAX_INSURABLE_AGE) {
      return {
        field: 'ageTo',
        message: `Enter an age between ${MIN_INSURABLE_AGE} and ${MAX_INSURABLE_AGE}.`,
      };
    }
    if (ageFrom > ageTo) {
      return { field: 'ageFrom', message: 'Age From cannot be greater than Age To.' };
    }
    return null;
  }

  const [ageError, setAgeError] = useState<{ field: string; message: string } | null>(null);

  function submit() {
    const issue = ageBandIssue();
    setAgeError(issue);
    if (issue) return;

    save.mutate(
      {
        ageFrom,
        ageTo,
        currency: values.currency.trim() === '' ? null : values.currency.trim(),
        annualPrice: toNumber(values.annualPrice),
        annualLimit: toNumber(values.annualLimit),
        deductible: toNumber(values.deductible),
        coPayment: toNumber(values.coPayment),
        isActive: values.isActive,
        // Identity is fixed after creation — only sent when creating.
        ...(configuration
          ? {}
          : {
              planId,
              customerType: values.customerType,
              geographicalCoverage: values.geographicalCoverage,
            }),
      },
      {
        onSuccess: () => {
          notify('The configuration was saved.');
          onClose();
        },
        onError: (error) => applyError(error, 'the configuration'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={configuration ? 'Edit configuration' : 'Add a configuration'}
      description="One price and benefit set for a specific customer type and coverage area."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save configuration'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError ? (
          <Callout tone="danger" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        {configuration ? null : (
          <>
            <ChoiceGroup
              name="customerType"
              legend="Who is this for?"
              options={listEnabledOptions(CUSTOMER_TYPES)}
              value={values.customerType}
              onChange={(id) => setValue('customerType', id as CustomerTypeId)}
              error={fieldErrors.customerType ?? null}
            />

            <ChoiceGroup
              name="geographicalCoverage"
              legend="Geographical coverage"
              columns={2}
              options={listEnabledOptions(GEOGRAPHICAL_COVERAGES)}
              value={values.geographicalCoverage}
              onChange={(id) => setValue('geographicalCoverage', id as GeographicalCoverageId)}
              error={fieldErrors.geographicalCoverage ?? null}
            />
          </>
        )}

        {/* Shown only when the rules fix an age for the chosen customer type. */}
        {resolvedAge?.label ? (
          <div className="border-brand-border bg-brand-soft flex items-start gap-3 rounded-(--radius-control) border px-4 py-3">
            <span className="bg-brand text-content-inverted flex size-8 shrink-0 items-center justify-center rounded-full">
              <IconUsers className="size-4" />
            </span>
            <div>
              <p className="text-content text-sm font-semibold">{resolvedAge.label}</p>
              <p className="text-content-muted mt-0.5 text-xs">
                Priced against the standard average age — you do not enter it.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Who this configuration is for, by age. Both bounds are required —
              a configuration nobody's age falls into can never be matched. */}
          <Field
            label="Age from"
            required
            error={
              ageError?.field === 'ageFrom' ? ageError.message : (fieldErrors.ageFrom ?? undefined)
            }
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
            error={
              ageError?.field === 'ageTo' ? ageError.message : (fieldErrors.ageTo ?? undefined)
            }
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

          <Field label="Deductible" error={fieldErrors.deductible}>
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

          <Field label="Status" error={fieldErrors.isActive}>
            {(props) => (
              <StatusToggle
                id={props.id}
                value={values.isActive}
                onChange={(isActive) => setValue('isActive', isActive)}
              />
            )}
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
