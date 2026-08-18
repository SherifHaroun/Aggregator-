import { useNavigate } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardFooter,
  Field,
  IconBuilding,
  Input,
  PageHeader,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useSaveCompany } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Step one of the company workflow: the name, and nothing else.
 *
 * Everything else about a company is added later from its own screen, so the
 * employee reaches the part that matters — the plans — in one field. On success
 * the flow continues straight into plan setup rather than returning to a list.
 */
export function AddCompanyPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const save = useSaveCompany();
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({ name: '' });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate(
      { name: values.name.trim(), isActive: true },
      {
        onSuccess: (company) => {
          notify(`${company.name} was created.`);
          navigate(ROUTES.companies.setup(company.id));
        },
        onError: (error) => applyError(error, 'the company'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Add a company"
        description="Step 1 of 2. You will set up this company's plans next."
        breadcrumbs={[{ label: 'Companies', to: ROUTES.companies.list }, { label: 'New company' }]}
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="space-y-5">
            {formError ? (
              <Callout tone="danger" title="Could not save">
                {formError}
              </Callout>
            ) : null}

            <Field label="Company name" required error={fieldErrors.name}>
              {(props) => (
                <Input
                  {...props}
                  autoFocus
                  value={values.name}
                  onChange={(event) => setValue('name', event.target.value)}
                  placeholder="Enter the company name"
                />
              )}
            </Field>
          </CardBody>

          <CardFooter>
            <Button variant="secondary" onClick={() => navigate(ROUTES.companies.list)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Creating…' : 'Create company'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <p className="text-content-subtle mt-6 flex items-center justify-center gap-2 text-xs">
        <IconBuilding className="size-4" />
        Companies, plans and benefits are all created by you — nothing is preloaded.
      </p>
    </div>
  );
}
