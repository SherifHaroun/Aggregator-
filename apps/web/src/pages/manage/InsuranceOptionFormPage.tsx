import { useNavigate } from 'react-router-dom';
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
  useInsuranceTypes,
  useSaveInsuranceOption,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Create a benefit. Its fields are defined afterwards, on the option's own
 * screen, so the employee can add as many as the benefit actually needs.
 */
export function InsuranceOptionFormPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const insuranceTypes = useInsuranceTypes({ isActive: true });
  const save = useSaveInsuranceOption();

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: '',
    description: '',
    insuranceTypeId: '',
    isActive: true,
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate(
      {
        name: values.name.trim(),
        description: values.description.trim() === '' ? null : values.description.trim(),
        insuranceTypeId: values.insuranceTypeId,
        isActive: values.isActive,
      },
      {
        onSuccess: (option) => {
          notify(`${option.name} was created.`);
          navigate(ROUTES.insuranceOptions.detail(option.id));
        },
        onError: (error) => applyError(error, 'the option'),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Add insurance option"
        description="A benefit that can be added to plan configurations."
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="space-y-6">
            {formError ? (
              <Callout tone="danger" title="Could not save">
                {formError}
              </Callout>
            ) : null}

            <FormSection title="Option">
              <Field label="Option name" required error={fieldErrors.name}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.name}
                    onChange={(event) => setValue('name', event.target.value)}
                  />
                )}
              </Field>

              <Field label="Insurance type" required error={fieldErrors.insuranceTypeId}>
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
                  </Select>
                )}
              </Field>

              <FullWidth>
                <Field label="Description" error={fieldErrors.description}>
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={3}
                      value={values.description}
                      onChange={(event) => setValue('description', event.target.value)}
                    />
                  )}
                </Field>
              </FullWidth>

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

            <Callout title="Fields come next">
              After saving you can define the information this benefit requires — for example a
              coverage percentage, a limit, or anything else it needs.
            </Callout>
          </CardBody>

          <CardFooter>
            <Button variant="secondary" onClick={() => navigate(ROUTES.insuranceOptions.list)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save option'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
