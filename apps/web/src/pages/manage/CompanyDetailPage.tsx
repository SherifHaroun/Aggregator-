import type { PlanDto } from '@aggregator/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Callout,
  Card,
  CompanyLogo,
  ConfirmDialog,
  DataState,
  EmptyState,
  Field,
  IconAdd,
  IconChevronRight,
  IconEdit,
  IconLayers,
  IconPlan,
  IconTrash,
  Input,
  LogoUploader,
  PageHeader,
  StatusToggle,
  StepCard,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES, SETUP_FLAG } from '@/config/routes';
import { PlanDialog } from '@/features/company-setup/PlanDialog';
import {
  useCompany,
  useDeleteCompany,
  useDeletePlan,
  useInsuranceTypes,
  usePlans,
  useSaveCompany,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * A company's complete structure on one screen: its details, and every plan
 * beneath it. This is where the workflow lands after creation, and the same
 * screen used to edit the company later.
 */
export function CompanyDetailPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const company = useCompany(companyId);
  const plans = usePlans(companyId ? { companyId } : {});
  const insuranceTypes = useInsuranceTypes();
  const deleteCompany = useDeleteCompany();
  const deletePlan = useDeletePlan();

  const [editingPlan, setEditingPlan] = useState<PlanDto | null | undefined>(undefined);
  const [pendingPlanDelete, setPendingPlanDelete] = useState<PlanDto | null>(null);
  const [confirmCompanyDelete, setConfirmCompanyDelete] = useState(false);

  const isSetup = searchParams.get(SETUP_FLAG) === '1';

  const typeName = useMemo(
    () => new Map((insuranceTypes.data ?? []).map((type) => [type.id, type.name])),
    [insuranceTypes.data],
  );

  return (
    <>
      <PageHeader
        title={company.data?.name ?? 'Company'}
        description={
          isSetup
            ? 'Company created. Now set up the insurance plans it offers.'
            : 'Manage this company and the plans beneath it.'
        }
        breadcrumbs={[
          { label: 'Companies', to: ROUTES.companies.list },
          { label: company.data?.name ?? 'Company' },
        ]}
        media={
          company.data ? (
            <CompanyLogo name={company.data.name} logoUrl={company.data.logoUrl} size="lg" />
          ) : null
        }
        actions={
          company.data ? (
            <Button variant="ghost" onClick={() => setConfirmCompanyDelete(true)}>
              <IconTrash className="size-4" />
              Delete
            </Button>
          ) : undefined
        }
      />

      <DataState
        isLoading={company.isLoading}
        error={company.error}
        data={company.data ? [company.data] : undefined}
        subject="the company"
        onRetry={() => void company.refetch()}
        empty={{ title: 'Company not found' }}
      >
        {() => (
          <div className="space-y-5">
            {isSetup ? (
              <Callout title="Step 2 of 2 — set up the plans">
                Add every plan this company sells. You can configure prices and benefits for each
                one straight afterwards.{' '}
                <button
                  type="button"
                  className="text-brand-strong font-semibold underline underline-offset-2"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  Dismiss
                </button>
              </Callout>
            ) : null}

            <CompanyInfoCard companyId={companyId!} />

            <StepCard
              step={2}
              title="Insurance plans"
              description="The products this company offers. Open one to set its prices and benefits."
              action={
                <Button size="sm" onClick={() => setEditingPlan(null)}>
                  <IconAdd className="size-4" />
                  Add plan
                </Button>
              }
            >
              {plans.isLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((row) => (
                    <div key={row} className="bg-surface-muted h-16 animate-pulse rounded-(--radius-control)" />
                  ))}
                </div>
              ) : (plans.data?.length ?? 0) === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={<IconPlan className="size-6" />}
                  title="No plans yet"
                  description="Add the first plan this company sells — for example its entry-level tier."
                  action={
                    <Button onClick={() => setEditingPlan(null)}>
                      <IconAdd className="size-4" />
                      Add plan
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {(plans.data ?? []).map((plan) => (
                    <li key={plan.id}>
                      <PlanRow
                        plan={plan}
                        companyId={companyId!}
                        typeName={typeName.get(plan.insuranceTypeId)}
                        onEdit={() => setEditingPlan(plan)}
                        onDelete={() => setPendingPlanDelete(plan)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </StepCard>
          </div>
        )}
      </DataState>

      {editingPlan !== undefined && companyId ? (
        <PlanDialog
          companyId={companyId}
          plan={editingPlan}
          onClose={() => setEditingPlan(undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingPlanDelete !== null}
        onClose={() => setPendingPlanDelete(null)}
        busy={deletePlan.isPending}
        title={`Delete ${pendingPlanDelete?.name ?? 'plan'}?`}
        description="This permanently removes the plan with all of its configurations, benefits and values. Deactivate it instead if it has been quoted or compared."
        onConfirm={() => {
          if (!pendingPlanDelete) return;
          deletePlan.mutate(pendingPlanDelete.id, {
            onSuccess: () => {
              notify('The plan was deleted.');
              setPendingPlanDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the plan'), 'error');
              setPendingPlanDelete(null);
            },
          });
        }}
      />

      <ConfirmDialog
        open={confirmCompanyDelete}
        onClose={() => setConfirmCompanyDelete(false)}
        busy={deleteCompany.isPending}
        title={`Delete ${company.data?.name ?? 'company'}?`}
        description="This permanently removes the company. If it already has plans the system will refuse — deactivate it instead so existing plans keep working."
        onConfirm={() => {
          if (!companyId) return;
          deleteCompany.mutate(companyId, {
            onSuccess: () => {
              notify('The company was deleted.');
              navigate(ROUTES.companies.list);
            },
            onError: (error) => {
              notify(describeError(error, 'the company'), 'error');
              setConfirmCompanyDelete(false);
            },
          });
        }}
      />
    </>
  );
}

/** Editable company details — the same two fields as creation, plus status. */
function CompanyInfoCard({ companyId }: { companyId: string }) {
  const { notify } = useToast();
  const company = useCompany(companyId);
  const save = useSaveCompany(companyId);
  const form = useRecordForm({ name: '', logoUrl: null as string | null, isActive: true });
  const { values, setValue, reset, fieldErrors, formError, applyError } = form;

  useEffect(() => {
    if (!company.data) return;
    reset({
      name: company.data.name,
      logoUrl: company.data.logoUrl,
      isActive: company.data.isActive,
    });
  }, [company.data, reset]);

  return (
    <StepCard step={1} title="Company information" description="Name, logo and availability.">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(
            { name: values.name.trim(), logoUrl: values.logoUrl, isActive: values.isActive },
            {
              onSuccess: () => notify('The company was saved.'),
              onError: (error) => applyError(error, 'the company'),
            },
          );
        }}
      >
        {formError ? (
          <Callout tone="danger" className="mb-4" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-5">
            <Field label="Company name" required error={fieldErrors.name}>
              {(props) => (
                <Input
                  {...props}
                  value={values.name}
                  onChange={(event) => setValue('name', event.target.value)}
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

          <Field label="Company logo" error={fieldErrors.logoUrl}>
            {(props) => (
              <LogoUploader
                id={props.id}
                value={values.logoUrl}
                onChange={(url) => setValue('logoUrl', url)}
              />
            )}
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}

function PlanRow({
  plan,
  companyId,
  typeName,
  onEdit,
  onDelete,
}: {
  plan: PlanDto;
  companyId: string;
  typeName: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover:border-brand-border flex flex-wrap items-center gap-3 p-4 transition-colors">
      <span className="bg-brand-soft text-brand flex size-10 shrink-0 items-center justify-center rounded-(--radius-control)">
        <IconLayers className="size-5" />
      </span>

      <Link to={ROUTES.plans.detail(companyId, plan.id)} className="min-w-0 flex-1">
        <span className="text-content block truncate font-semibold">{plan.name}</span>
        <span className="text-content-subtle block truncate text-xs">
          {plan.code}
          {typeName ? ` · ${typeName}` : ''}
          {plan.category ? ` · ${plan.category}` : ''}
        </span>
      </Link>

      <Badge tone={plan.isActive ? 'success' : 'neutral'}>
        {plan.isActive ? 'Active' : 'Inactive'}
      </Badge>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${plan.name}`}
          className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
        >
          <IconEdit className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${plan.name}`}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-2"
        >
          <IconTrash className="size-4" />
        </button>
        <Link
          to={ROUTES.plans.detail(companyId, plan.id)}
          aria-label={`Configure ${plan.name}`}
          className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) p-2"
        >
          <IconChevronRight className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
