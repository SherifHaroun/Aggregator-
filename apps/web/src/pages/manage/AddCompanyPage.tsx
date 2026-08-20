import { useNavigate } from 'react-router-dom';
import {
  Button,
  Callout,
  Card,
  Field,
  IconBuilding,
  IconChevronRight,
  IconLayers,
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
 *
 * Laid out like the comparison: one panel across the page, a navy header, and
 * the step it belongs to shown against its progress.
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
    <div className="w-full">
      {/* Trail only — the heading belongs to the panel below. */}
      <PageHeader
        breadcrumbs={[{ label: 'Companies', to: ROUTES.companies.list }, { label: 'New company' }]}
      />

      <Card className="overflow-hidden">
        <div className="bg-brand-gradient text-content-inverted px-6 py-8 sm:px-10 sm:py-12">
          <p className="text-sm font-medium text-white/80">New insurance company</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Add a company</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
            Start with the name. You will set up the plans this company offers next.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-6 py-7 sm:px-10 sm:py-9">
          <div className="flex items-center gap-3">
            <span className="bg-brand text-content-inverted rounded-(--radius-pill) px-3 py-1 text-xs font-bold">
              1 / 2
            </span>
            <span className="text-content text-sm font-medium">Company details</span>
          </div>
          <div className="bg-surface-muted mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-brand h-full w-1/2 rounded-full" />
          </div>

          {formError ? (
            <Callout tone="danger" title="Could not save" className="mt-7">
              {formError}
            </Callout>
          ) : null}

          <div className="mt-7 grid gap-x-8 gap-y-6 lg:grid-cols-2">
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

            {/* What the second step will ask for, so the name is not the whole
                story on an otherwise empty page. */}
            <div className="border-border-subtle bg-surface-muted/40 rounded-(--radius-control) border p-4">
              <p className="text-content flex items-center gap-2 text-sm font-semibold">
                <IconLayers className="text-brand size-4" />
                Next: this company's plans
              </p>
              <p className="text-content-muted mt-2 text-xs leading-relaxed">
                You will add each plan it offers with its price, the ages it covers and the benefits
                it carries. Everything here is created by you — nothing is preloaded.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate(ROUTES.companies.list)}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending ? 'Creating…' : 'Create company'}
              <IconChevronRight className="size-4" />
            </Button>
          </div>

          <p className="text-content-subtle mt-6 flex items-center justify-center gap-2 text-xs">
            <IconBuilding className="size-4" />
            Companies, plans and benefits are all created by you — nothing is preloaded.
          </p>
        </form>
      </Card>
    </div>
  );
}
