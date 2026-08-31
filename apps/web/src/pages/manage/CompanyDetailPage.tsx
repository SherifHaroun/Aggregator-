import {
  CUSTOMER_TYPES,
  optionLabel,
  type CompanyDto,
  type CustomerTypeId,
  type PlanDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CompanyLogo,
  ConfirmDialog,
  DataState,
  Dialog,
  EmptyState,
  Field,
  IconAdd,
  IconBuilding,
  IconChevronRight,
  IconEdit,
  IconLayers,
  IconTrash,
  Input,
  LogoUploader,
  PageHeader,
  StatusToggle,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { CompanyMedicalNetworks } from '@/features/companies/CompanyMedicalNetworks';
import { PlanSetupForm } from '@/features/company-setup/PlanSetupForm';
import { CustomerTypeTabs } from '@/features/companies/CustomerTypeTabs';
import {
  useCompany,
  useDeleteCompany,
  useDeletePlan,
  usePlans,
  useSaveCompany,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Everything about one company in one place: its details, and every plan
 * beneath it. Opening a plan continues into its configurations and benefits.
 */
export function CompanyDetailPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const company = useCompany(companyId);
  const plans = usePlans(companyId ? { companyId } : {});
  const deleteCompany = useDeleteCompany();
  const deletePlan = useDeletePlan();

  /**
   * Which of the company's three books is open. Individual first because it is
   * the one most companies have most of, and because a section always has to be
   * chosen — there is no "all plans" view, since the three do not belong in one
   * list.
   */
  const [customerType, setCustomerType] = useState<CustomerTypeId>('INDIVIDUAL');

  const [editingCompany, setEditingCompany] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [pendingPlanDelete, setPendingPlanDelete] = useState<PlanDto | null>(null);
  const [confirmCompanyDelete, setConfirmCompanyDelete] = useState(false);

  const allPlans = plans.data ?? [];
  /** The section's own plans — never the company's whole list. */
  const visiblePlans = allPlans.filter((plan) => plan.customerType === customerType);
  const counts = allPlans.reduce<Partial<Record<CustomerTypeId, number>>>((tally, plan) => {
    tally[plan.customerType] = (tally[plan.customerType] ?? 0) + 1;
    return tally;
  }, {});

  return (
    <>
      <PageHeader
        title={company.data?.name ?? 'Company'}
        description="Manage this company and the plans it sells."
        breadcrumbs={[
          { label: 'Companies', to: ROUTES.companies.list },
          { label: company.data?.name ?? 'Company' },
        ]}
        media={
          company.data ? (
            <CompanyLogo name={company.data.name} logoUrl={company.data.logoUrl} size="lg" />
          ) : null
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
        {([current]) => (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Company"
                icon={<IconBuilding className="size-5" />}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditingCompany(true)}>
                      <IconEdit className="size-4" />
                      Edit company
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmCompanyDelete(true)}>
                      <IconTrash className="size-4" />
                      Delete
                    </Button>
                  </div>
                }
              />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Detail label="Company name" value={current!.name} />
                <div>
                  <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">
                    Status
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={current!.isActive ? 'success' : 'neutral'}>
                      {current!.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* A network belongs to the company, not to a plan and not to a
                benefit: it is the estate of providers this insurer sells access
                to, and its plans pick from this list. */}
            <CompanyMedicalNetworks companyId={company.data!.id} />

            <Card>
              <CardHeader
                title={`${optionLabel(CUSTOMER_TYPES, customerType)} plans`}
                icon={<IconLayers className="size-5" />}
                description="Open a plan to manage its variants and benefits."
                action={
                  <Button size="sm" onClick={() => setAddingPlan(true)}>
                    <IconAdd className="size-4" />
                    Add plan
                  </Button>
                }
              />
              <CardBody className="space-y-4">
                <CustomerTypeTabs
                  value={customerType}
                  onChange={setCustomerType}
                  counts={counts}
                />

                {plans.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((row) => (
                      <div
                        key={row}
                        className="bg-surface-muted h-14 animate-pulse rounded-(--radius-control)"
                      />
                    ))}
                  </div>
                ) : visiblePlans.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    icon={<IconLayers className="size-6" />}
                    title={`No ${optionLabel(CUSTOMER_TYPES, customerType).toLowerCase()} plans yet`}
                    description={`Add the first plan this company sells to ${optionLabel(CUSTOMER_TYPES, customerType).toLowerCase()} customers.`}
                    action={
                      <Button onClick={() => setAddingPlan(true)}>
                        <IconAdd className="size-4" />
                        Add plan
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {visiblePlans.map((plan) => (
                      <li key={plan.id}>
                        <PlanRow
                          plan={plan}
                          companyId={companyId!}
                          onDelete={() => setPendingPlanDelete(plan)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>

      {editingCompany && company.data ? (
        <EditCompanyDialog company={company.data} onClose={() => setEditingCompany(false)} />
      ) : null}

      {addingPlan && companyId ? (
        <Dialog
          open
          size="lg"
          onClose={() => setAddingPlan(false)}
          title="Add a plan"
          description="The plan and its first price. More combinations can be added from the plan itself."
        >
          <PlanSetupForm
            companyId={companyId}
            companyName={company.data?.name}
            /* The plan is created under the section the employee is looking
               at — asking again would be asking a question they have already
               answered by being here. */
            customerType={customerType}
            onCreated={() => setAddingPlan(false)}
          />
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={pendingPlanDelete !== null}
        onClose={() => setPendingPlanDelete(null)}
        busy={deletePlan.isPending}
        title={`Delete ${pendingPlanDelete?.name ?? 'plan'}?`}
        description="This permanently removes the plan with all of its configurations, benefits and values."
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-content-subtle text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-content mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

/** Name, logo and status — the only company fields the system keeps. */
function EditCompanyDialog({ company, onClose }: { company: CompanyDto; onClose: () => void }) {
  const { notify } = useToast();
  const save = useSaveCompany(company.id);
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: company.name,
    logoUrl: company.logoUrl,
    isActive: company.isActive,
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit company"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { name: values.name.trim(), logoUrl: values.logoUrl, isActive: values.isActive },
                {
                  onSuccess: () => {
                    notify('The company was saved.');
                    onClose();
                  },
                  onError: (error) => applyError(error, 'the company'),
                },
              )
            }
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
    </Dialog>
  );
}

function PlanRow({
  plan,
  companyId,
  onDelete,
}: {
  plan: PlanDto;
  companyId: string;
  onDelete: () => void;
}) {
  return (
    <Card className="hover:border-brand-border flex flex-wrap items-center gap-3 p-3.5 transition-colors">
      <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-(--radius-control)">
        <IconLayers className="size-5" />
      </span>

      <Link to={ROUTES.plans.detail(companyId, plan.id)} className="min-w-0 flex-1">
        <span className="text-content block truncate font-semibold">{plan.name}</span>
        <span className="text-content-subtle block truncate text-xs">{plan.code}</span>
      </Link>

      <Badge tone={plan.isActive ? 'success' : 'neutral'}>
        {plan.isActive ? 'Active' : 'Inactive'}
      </Badge>

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
        aria-label={`Manage ${plan.name}`}
        className="text-brand-strong bg-brand-soft hover:bg-brand hover:text-content-inverted inline-flex items-center gap-1 rounded-(--radius-control) px-3 py-2 text-sm font-semibold transition-colors"
      >
        Manage
        <IconChevronRight className="size-4" />
      </Link>
    </Card>
  );
}
