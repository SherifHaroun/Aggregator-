import { useNavigate } from 'react-router-dom';
import {
  Button,
  Callout,
  CardFooter,
  Field,
  IconBuilding,
  IconSparkle,
  LogoUploader,
  PageHeader,
  StepCard,
  Input,
  useToast,
} from '@/components/ui';
import { ROUTES, SETUP_FLAG } from '@/config/routes';
import { useSaveCompany } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Step one of the company workflow: just a name and a logo.
 *
 * Everything else about a company is added later from its own screen, so the
 * employee can get to the part that matters — the plans — in one short form.
 * On success the flow continues straight into that company's setup rather than
 * returning to a list.
 */
export function AddCompanyPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const save = useSaveCompany();
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: '',
    logoUrl: null as string | null,
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.mutate(
      { name: values.name.trim(), logoUrl: values.logoUrl, isActive: true },
      {
        onSuccess: (company) => {
          notify(`${company.name} was created.`);
          // Straight into the setup flow — never back to the dashboard.
          navigate(`${ROUTES.companies.detail(company.id)}?${SETUP_FLAG}=1`);
        },
        onError: (error) => applyError(error, 'the company'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add a new company"
        description="Start with the essentials. You will set up this company's insurance plans next."
        breadcrumbs={[{ label: 'Companies', to: ROUTES.companies.list }, { label: 'New company' }]}
      />

      <form onSubmit={handleSubmit} noValidate>
        <StepCard step={1} title="Company details" description="Only two things to fill in.">
          <div className="space-y-5">
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

            <Field label="Company logo" error={fieldErrors.logoUrl} hint="Optional.">
              {(props) => (
                <LogoUploader
                  id={props.id}
                  value={values.logoUrl}
                  onChange={(url) => setValue('logoUrl', url)}
                />
              )}
            </Field>
          </div>
        </StepCard>

        <div className="mt-5">
          <Callout title="What happens next" tone="info">
            After saving you will land on this company's setup screen, where you add its insurance
            plans and configure the benefits for each one.
          </Callout>
        </div>

        <CardFooter className="border-border-subtle bg-surface mt-5 rounded-(--radius-card) border">
          <Button variant="secondary" onClick={() => navigate(ROUTES.companies.list)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? (
              'Creating…'
            ) : (
              <>
                <IconSparkle className="size-4" />
                Create &amp; set up plans
              </>
            )}
          </Button>
        </CardFooter>
      </form>

      <p className="text-content-subtle mt-6 flex items-center justify-center gap-2 text-xs">
        <IconBuilding className="size-4" />
        Companies, plans and benefits are all created by you — nothing is preloaded.
      </p>
    </div>
  );
}
