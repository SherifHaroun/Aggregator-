import {
  GEOGRAPHICAL_COVERAGES,
  UNSPECIFIED_OPTION_LABEL,
  listEnabledOptions,
  type GeographicalCoverageId,
  type PlanConfigurationDto,
} from '@aggregator/shared';
import {
  Button,
  Callout,
  ChoiceGroup,
  Dialog,
  Field,
  Input,
  NumberInput,
  Select,
  StatusToggle,
  useToast,
} from '@/components/ui';
import {
  useMedicalNetworks,
  useSavePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

/**
 * Create or edit ONE VARIANT of a plan — the plan sold one way.
 *
 * A variant is where it covers, on which network, at which ceiling. Not who it
 * is for: that belongs to the plan, and every variant of an SME plan is sold to
 * an SME. Not what it costs: age is the only thing that varies between a
 * variant's prices, so the rate table is a set of bands edited inside the
 * variant rather than a single figure typed here.
 *
 * That is also why there is no longer a "copy to another age". The same cover
 * at ten premiums used to mean ten configurations, each carrying a duplicate of
 * every benefit; it is now ten rows under one variant, so the work that dialog
 * existed to spare the employee no longer happens.
 *
 * Coverage options are read from the shared business configuration, so this
 * dialog never names them itself.
 */
export function ConfigurationDialog({
  planId,
  companyId,
  configuration,
  onClose,
}: {
  planId: string;
  /** Whose networks are on offer — never another insurer's. */
  companyId: string;
  /** `null` creates a new variant. */
  configuration: PlanConfigurationDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  // Only THIS company's networks. Another insurer's list is not on offer here.
  const networks = useMedicalNetworks(companyId);
  const save = useSavePlanConfiguration(configuration?.id);

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    geographicalCoverage: (configuration?.geographicalCoverage ??
      null) as GeographicalCoverageId | null,
    medicalNetworkId: configuration?.medicalNetworkId ?? '',
    currency: configuration?.currency ?? '',
    annualLimit: configuration?.annualLimit?.toString() ?? '',
    deductible: configuration?.deductible?.toString() ?? '',
    coPayment: configuration?.coPayment?.toString() ?? '',
    isActive: configuration?.isActive ?? true,
  });

  function submit() {
    save.mutate(
      {
        // What makes this variant different from the plan's others.
        medicalNetworkId: values.medicalNetworkId === '' ? null : values.medicalNetworkId,
        currency: values.currency.trim() === '' ? null : values.currency.trim(),
        annualLimit: toNumber(values.annualLimit),
        deductible: toNumber(values.deductible),
        coPayment: toNumber(values.coPayment),
        isActive: values.isActive,
        /**
         * Coverage identifies the variant, so it is set once and never edited:
         * changing it would move every benefit value attached below it.
         */
        ...(configuration ? {} : { planId, geographicalCoverage: values.geographicalCoverage }),
      },
      {
        onSuccess: () => {
          notify(configuration ? 'The variant was saved.' : 'The variant was added.');
          onClose();
        },
        onError: (error) => applyError(error, 'the variant'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={configuration ? 'Edit variant' : 'Add a variant'}
      description="The plan sold one way — one coverage scope, one network, one ceiling. Its benefits and prices are edited inside it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save variant'}
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
          <ChoiceGroup
            name="geographicalCoverage"
            legend="Geographical coverage"
            columns={2}
            options={listEnabledOptions(GEOGRAPHICAL_COVERAGES)}
            value={values.geographicalCoverage}
            onChange={(id) => setValue('geographicalCoverage', id as GeographicalCoverageId)}
            error={fieldErrors.geographicalCoverage ?? null}
          />
        )}

        {/* WHAT MAKES THIS A DIFFERENT VARIANT.
            The same plan sold on another network, or at another ceiling, is a
            second variant — which is why these sit here and not on the plan.
            Room type is not among them: it is an optional benefit, so a plan
            that states one says so with its benefits. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Medical network"
            error={fieldErrors.medicalNetworkId}
            hint={
              (networks.data?.length ?? 0) === 0
                ? 'This company has no networks yet. Add them on the company screen.'
                : 'Chosen from this company own list, never typed.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={values.medicalNetworkId}
                disabled={(networks.data?.length ?? 0) === 0}
                onChange={(event) => setValue('medicalNetworkId', event.target.value)}
              >
                <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
                {(networks.data ?? []).map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Annual limit"
            error={fieldErrors.annualLimit}
            hint="The ceiling. The same plan at another ceiling is another variant."
          >
            {(props) => (
              <NumberInput
                {...props}
                suffix={values.currency || ''}
                value={values.annualLimit}
                onChange={(value) => setValue('annualLimit', value)}
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

          {/* Left blank when the plan document does not state one. */}
          <Field label="Deductible" error={fieldErrors.deductible} hint={NOT_STATED_HINT}>
            {(props) => (
              <NumberInput
                {...props}
                suffix={values.currency || ''}
                value={values.deductible}
                onChange={(next) => setValue('deductible', next)}
              />
            )}
          </Field>

          <Field label="Co-payment" error={fieldErrors.coPayment} hint={NOT_STATED_HINT}>
            {(props) => (
              <NumberInput
                {...props}
                suffix="%"
                value={values.coPayment}
                onChange={(next) => setValue('coPayment', next)}
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

/** Says what a blank field means, so nobody types a 0 that isn't in the plan. */
const NOT_STATED_HINT = 'Leave blank if the plan does not state one.';
