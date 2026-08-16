import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  listEnabledOptions,
  resolveAverageAgeForCustomerType,
  type CustomerTypeId,
  type GeographicalCoverageId,
} from '@aggregator/shared';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardFooter,
  Field,
  FormSection,
  Input,
  InputWithSuffix,
  OptionCardGroup,
  PageHeader,
  StatusToggle,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { usePlan, useSavePlanConfiguration } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

interface ConfigurationFormValues {
  customerType: CustomerTypeId | null;
  geographicalCoverage: GeographicalCoverageId | null;
  currency: string;
  annualPrice: string;
  annualLimit: string;
  deductible: string;
  coPayment: string;
  isActive: boolean;
}

const EMPTY: ConfigurationFormValues = {
  customerType: null,
  geographicalCoverage: null,
  currency: '',
  annualPrice: '',
  annualLimit: '',
  deductible: '',
  coPayment: '',
  isActive: true,
};

/** Blank stays blank; otherwise send a number so the API can validate it. */
const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

export function PlanConfigurationFormPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const plan = usePlan(planId);
  const save = useSavePlanConfiguration();
  const { values, setValue, fieldErrors, formError, applyError } =
    useRecordForm<ConfigurationFormValues>(EMPTY);

  /**
   * The age that applies to the chosen customer type, straight from the
   * centralized business rule. The employee never types it, and the number
   * itself appears nowhere in this file.
   */
  const resolvedAge = values.customerType
    ? resolveAverageAgeForCustomerType(values.customerType)
    : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate(
      {
        planId,
        customerType: values.customerType,
        geographicalCoverage: values.geographicalCoverage,
        currency: values.currency.trim() === '' ? null : values.currency.trim(),
        annualPrice: toNumber(values.annualPrice),
        annualLimit: toNumber(values.annualLimit),
        deductible: toNumber(values.deductible),
        coPayment: toNumber(values.coPayment),
        isActive: values.isActive,
      },
      {
        onSuccess: (configuration) => {
          notify('The configuration was created.');
          navigate(ROUTES.planConfigurations.detail(configuration.id));
        },
        onError: (error) => applyError(error, 'the configuration'),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Add configuration"
        description={
          plan.data
            ? `A version of ${plan.data.name} for one customer type and coverage area.`
            : undefined
        }
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="space-y-8">
            {formError ? (
              <Callout tone="danger" title="Could not save">
                {formError}
              </Callout>
            ) : null}

            <OptionCardGroup
              name="customerType"
              legend="Who is this configuration for?"
              options={listEnabledOptions(CUSTOMER_TYPES)}
              value={values.customerType}
              onChange={(id) => setValue('customerType', id as CustomerTypeId)}
              error={fieldErrors.customerType ?? null}
            />

            <OptionCardGroup
              name="geographicalCoverage"
              legend="Geographical coverage"
              options={listEnabledOptions(GEOGRAPHICAL_COVERAGES)}
              value={values.geographicalCoverage}
              onChange={(id) => setValue('geographicalCoverage', id as GeographicalCoverageId)}
              error={fieldErrors.geographicalCoverage ?? null}
              columns={2}
            />

            {/* Informational only — shown when the rules fix an age for this customer type. */}
            {resolvedAge?.label ? (
              <Callout title={resolvedAge.label}>
                This configuration is priced against the standard average age. You do not need to
                enter it.
              </Callout>
            ) : null}

            <FormSection title="Pricing">
              <Field
                label="Currency"
                error={fieldErrors.currency}
                hint="Three-letter code, e.g. EGP."
              >
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
            </FormSection>

            <Callout title="Benefits come next">
              After saving, drag benefits onto this configuration and set their values.
            </Callout>
          </CardBody>

          <CardFooter>
            <Button
              variant="secondary"
              onClick={() => navigate(planId ? ROUTES.plans.detail(planId) : ROUTES.plans.list)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save configuration'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
