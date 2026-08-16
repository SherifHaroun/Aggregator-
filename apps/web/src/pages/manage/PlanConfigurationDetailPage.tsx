import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DataState,
  Field,
  Input,
  InputWithSuffix,
  PageHeader,
  StatusToggle,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useInsuranceOptions,
  usePlan,
  usePlanConfiguration,
  useSavePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { configurationLabel } from '@/features/insurance-data/labels';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';
import { ConfigurationOptionsBoard } from '@/features/plan-configuration/ConfigurationOptionsBoard';

/**
 * Everything about one configuration: its pricing, and the benefits attached to
 * it with their values.
 *
 * Values edited here belong to THIS configuration only — a sibling
 * configuration of the same plan keeps its own.
 */
export function PlanConfigurationDetailPage() {
  const { configurationId } = useParams();
  const configuration = usePlanConfiguration(configurationId);
  const plan = usePlan(configuration.data?.planId);

  // Only benefits defined for this plan's insurance type can be attached.
  const options = useInsuranceOptions({
    ...(plan.data ? { insuranceTypeId: plan.data.insuranceTypeId } : {}),
    isActive: true,
  });

  return (
    <>
      <PageHeader
        title={
          configuration.data
            ? configurationLabel(
                configuration.data.customerType,
                configuration.data.geographicalCoverage,
              )
            : 'Configuration'
        }
        description={plan.data ? plan.data.name : undefined}
      />

      {plan.data ? (
        <div className="mb-4">
          <Link
            to={ROUTES.plans.detail(plan.data.id)}
            className="text-content-muted hover:text-content text-sm"
          >
            ← {plan.data.name}
          </Link>
        </div>
      ) : null}

      <DataState
        isLoading={configuration.isLoading}
        error={configuration.error}
        data={configuration.data ? [configuration.data] : undefined}
        subject="the configuration"
        onRetry={() => void configuration.refetch()}
        empty={{ title: 'Configuration not found' }}
      >
        {([current]) => (
          <div className="space-y-6">
            <PricingCard configuration={current!} />

            <section>
              <h2 className="text-content mb-1 text-lg font-semibold">Benefits</h2>
              <p className="text-content-muted mb-4 text-sm">
                Drag benefits onto this configuration, reorder them, and set their values. These
                values apply to this configuration only.
              </p>

              <ConfigurationOptionsBoard
                configurationId={current!.id}
                attached={current!.options ?? []}
                available={options.data ?? []}
              />
            </section>
          </div>
        )}
      </DataState>
    </>
  );
}

/** Editable pricing for the configuration. */
function PricingCard({
  configuration,
}: {
  configuration: NonNullable<ReturnType<typeof usePlanConfiguration>['data']>;
}) {
  const { notify } = useToast();
  const save = useSavePlanConfiguration(configuration.id);

  const form = useRecordForm({
    currency: configuration.currency ?? '',
    annualPrice: configuration.annualPrice?.toString() ?? '',
    annualLimit: configuration.annualLimit?.toString() ?? '',
    deductible: configuration.deductible?.toString() ?? '',
    coPayment: configuration.coPayment?.toString() ?? '',
    isActive: configuration.isActive,
  });
  const { values, setValue, reset, fieldErrors, formError, applyError } = form;

  useEffect(() => {
    reset({
      currency: configuration.currency ?? '',
      annualPrice: configuration.annualPrice?.toString() ?? '',
      annualLimit: configuration.annualLimit?.toString() ?? '',
      deductible: configuration.deductible?.toString() ?? '',
      coPayment: configuration.coPayment?.toString() ?? '',
      isActive: configuration.isActive,
    });
  }, [configuration, reset]);

  const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate(
      {
        currency: values.currency.trim() === '' ? null : values.currency.trim(),
        annualPrice: toNumber(values.annualPrice),
        annualLimit: toNumber(values.annualLimit),
        deductible: toNumber(values.deductible),
        coPayment: toNumber(values.coPayment),
        isActive: values.isActive,
      },
      {
        onSuccess: () => notify('The configuration was saved.'),
        onError: (error) => applyError(error, 'the configuration'),
      },
    );
  }

  return (
    <Card>
      <CardHeader title="Pricing" description="Applies to this customer type and coverage area." />
      <CardBody>
        {/* Informational, resolved from the centralized business rule. */}
        {configuration.averageAge.label ? (
          <Callout className="mb-4" title={configuration.averageAge.label}>
            This configuration is priced against the standard average age.
          </Callout>
        ) : null}

        {formError ? (
          <Callout tone="danger" className="mb-4" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Currency" error={fieldErrors.currency}>
              {(props) => (
                <Input
                  {...props}
                  maxLength={3}
                  value={values.currency}
                  onChange={(event) => setValue('currency', event.target.value.toUpperCase())}
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

          <div className="mt-4 flex justify-end">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save pricing'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
