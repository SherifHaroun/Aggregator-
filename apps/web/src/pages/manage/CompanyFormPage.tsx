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
  LogoUploader,
  PageHeader,
  StatusToggle,
  Textarea,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useCompany, useSaveCompany } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

interface CompanyFormValues {
  name: string;
  shortName: string;
  logoUrl: string | null;
  description: string;
  website: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  isActive: boolean;
}

const EMPTY: CompanyFormValues = {
  name: '',
  shortName: '',
  logoUrl: null,
  description: '',
  website: '',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  isActive: true,
};

/** Serves both "Add company" and "Edit company". */
export function CompanyFormPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const existing = useCompany(companyId);
  const save = useSaveCompany(companyId);
  const form = useRecordForm<CompanyFormValues>(EMPTY);
  const { reset } = form;

  useEffect(() => {
    if (!existing.data) return;
    const company = existing.data;
    reset({
      name: company.name,
      shortName: company.shortName ?? '',
      logoUrl: company.logoUrl,
      description: company.description ?? '',
      website: company.website ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      mobile: company.mobile ?? '',
      address: company.address ?? '',
      isActive: company.isActive,
    });
  }, [existing.data, reset]);

  const { values, setValue, fieldErrors, formError, applyError } = form;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Optional text fields are sent as null when blank, so the API clears them.
    const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

    save.mutate(
      {
        name: values.name.trim(),
        shortName: blankToNull(values.shortName),
        logoUrl: values.logoUrl,
        description: blankToNull(values.description),
        website: blankToNull(values.website),
        email: blankToNull(values.email),
        phone: blankToNull(values.phone),
        mobile: blankToNull(values.mobile),
        address: blankToNull(values.address),
        isActive: values.isActive,
      },
      {
        onSuccess: (company) => {
          notify(`${company.name} was saved.`);
          navigate(ROUTES.companies.list);
        },
        onError: (error) => applyError(error, 'the company'),
      },
    );
  }

  return (
    <>
      <PageHeader
        title={companyId ? 'Edit insurance company' : 'Add new insurance company'}
        description="Company details used throughout the insurance database."
      />

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="space-y-6">
            {formError ? (
              <Callout tone="danger" title="Could not save">
                {formError}
              </Callout>
            ) : null}

            <FormSection title="Company information">
              <FullWidth>
                <Field label="Company logo" error={fieldErrors.logoUrl}>
                  {(props) => (
                    <LogoUploader
                      id={props.id}
                      value={values.logoUrl}
                      onChange={(url) => setValue('logoUrl', url)}
                    />
                  )}
                </Field>
              </FullWidth>

              <Field label="Company name" required error={fieldErrors.name}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.name}
                    onChange={(event) => setValue('name', event.target.value)}
                    placeholder="Legal or trading name"
                  />
                )}
              </Field>

              <Field label="Short name" error={fieldErrors.shortName} hint="Abbreviation used in tables.">
                {(props) => (
                  <Input
                    {...props}
                    value={values.shortName}
                    onChange={(event) => setValue('shortName', event.target.value)}
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

            <FormSection title="Contact information">
              <Field label="Website" error={fieldErrors.website}>
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={values.website}
                    onChange={(event) => setValue('website', event.target.value)}
                    placeholder="https://"
                  />
                )}
              </Field>

              <Field label="Email" error={fieldErrors.email}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={values.email}
                    onChange={(event) => setValue('email', event.target.value)}
                  />
                )}
              </Field>

              <Field label="Phone" error={fieldErrors.phone}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.phone}
                    onChange={(event) => setValue('phone', event.target.value)}
                  />
                )}
              </Field>

              <Field label="Mobile" error={fieldErrors.mobile}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.mobile}
                    onChange={(event) => setValue('mobile', event.target.value)}
                  />
                )}
              </Field>

              <FullWidth>
                <Field label="Address" error={fieldErrors.address}>
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={3}
                      value={values.address}
                      onChange={(event) => setValue('address', event.target.value)}
                    />
                  )}
                </Field>
              </FullWidth>
            </FormSection>

            <FormSection title="Status">
              <Field label="Availability" error={fieldErrors.isActive}>
                {(props) => (
                  <StatusToggle
                    id={props.id}
                    value={values.isActive}
                    onChange={(isActive) => setValue('isActive', isActive)}
                  />
                )}
              </Field>
            </FormSection>
          </CardBody>

          <CardFooter>
            <Button variant="secondary" onClick={() => navigate(ROUTES.companies.list)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save company'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
