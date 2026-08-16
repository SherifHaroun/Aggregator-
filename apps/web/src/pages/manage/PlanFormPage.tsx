import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardFooter,
  Field,
  FormSection,
  FullWidth,
  Input,
  PageHeader,
  Select,
  StatusToggle,
  Textarea,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCompanies,
  useInsuranceTypes,
  usePlan,
  useSavePlan,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

interface PlanFormValues {
  companyId: string;
  insuranceTypeId: string;
  name: string;
  code: string;
  description: string;
  category: string;
  isActive: boolean;
}

const EMPTY: PlanFormValues = {
  companyId: '',
  insuranceTypeId: '',
  name: '',
  code: '',
  description: '',
  category: '',
  isActive: true,
};

/**
 * A plan is the insurance PRODUCT. It deliberately has no price, coverage or
 * benefits — those differ per customer type and coverage area and belong to the
 * plan's configurations.
 */
export function PlanFormPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const companies = useCompanies({ isActive: true });
  const insuranceTypes = useInsuranceTypes({ isActive: true });
  const existing = usePlan(planId);
  const save = useSavePlan(planId);

  const form = useRecordForm<PlanFormValues>(EMPTY);
  const { reset, values, setValue, fieldErrors, formError, applyError } = form;

  useEffect(() => {
    if (!existing.data) return;
    const plan = existing.data;
    reset({
      companyId: plan.companyId,
      insuranceTypeId: plan.insuranceTypeId,
      name: plan.name,
      code: plan.code,
      description: plan.description ?? '',
      category: plan.category ?? '',
      isActive: plan.isActive,
    });
  }, [existing.data, reset]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

    // Company and insurance type are fixed after creation — the API rejects them
    // on update, so they are only sent when creating.
    const payload = {
      name: values.name.trim(),
      code: values.code.trim(),
      description: blankToNull(values.description),
      category: blankToNull(values.category),
      isActive: values.isActive,
      ...(planId
        ? {}
        : { companyId: values.companyId, insuranceTypeId: values.insuranceTypeId }),
    };

    save.mutate(payload, {
      onSuccess: (plan) => {
        notify(`${plan.name} was saved.`);
        navigate(ROUTES.plans.detail(plan.id));
      },
      onError: (error) => applyError(error, 'the plan'),
    });
  }

  return (
    <>
      <PageHeader
        title={planId ? 'Edit plan' : 'Add plan'}
        description="The insurance product itself. Prices and benefits are set per configuration."
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="space-y-6">
            {formError ? (
              <Callout tone="danger" title="Could not save">
                {formError}
              </Callout>
            ) : null}

            <FormSection
              title="Product"
              description={
                planId
                  ? 'Company and insurance type cannot be changed after creation.'
                  : undefined
              }
            >
              <Field label="Company" required error={fieldErrors.companyId}>
                {(props) => (
                  <Select
                    {...props}
                    value={values.companyId}
                    disabled={Boolean(planId)}
                    onChange={(event) => setValue('companyId', event.target.value)}
                  >
                    <option value="">Select a company</option>
                    {(companies.data ?? []).map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Insurance type" required error={fieldErrors.insuranceTypeId}>
                {(props) => (
                  <Select
                    {...props}
                    value={values.insuranceTypeId}
                    disabled={Boolean(planId)}
                    onChange={(event) => setValue('insuranceTypeId', event.target.value)}
                  >
                    <option value="">Select an insurance type</option>
                    {(insuranceTypes.data ?? []).map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Plan name" required error={fieldErrors.name}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.name}
                    onChange={(event) => setValue('name', event.target.value)}
                  />
                )}
              </Field>

              <Field
                label="Plan code"
                required
                error={fieldErrors.code}
                hint="Unique within the company."
              >
                {(props) => (
                  <Input
                    {...props}
                    value={values.code}
                    onChange={(event) => setValue('code', event.target.value)}
                  />
                )}
              </Field>

              <Field
                label="Category"
                error={fieldErrors.category}
                hint="Used to group equivalent plans when comparing."
              >
                {(props) => (
                  <Input
                    {...props}
                    value={values.category}
                    onChange={(event) => setValue('category', event.target.value)}
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

              <FullWidth>
                <Field label="Description" error={fieldErrors.description}>
                  {(props) => (
                    <Textarea
                      {...props}
                      value={values.description}
                      onChange={(event) => setValue('description', event.target.value)}
                    />
                  )}
                </Field>
              </FullWidth>
            </FormSection>

            <Callout title="Prices and benefits come next">
              After saving, add configurations to this plan — one per customer type and
              geographical coverage — and set the price and benefits on each.
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
              {save.isPending ? 'Saving…' : 'Save plan'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
