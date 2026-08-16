import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  listEnabledOptions,
  resolveAverageAgeForCustomerType,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type PlanConfigurationDto,
} from '@aggregator/shared';
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

  function submit() {
    save.mutate(
      {
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
