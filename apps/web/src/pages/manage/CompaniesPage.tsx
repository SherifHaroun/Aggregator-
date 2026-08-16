import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ButtonLink,
  ConfirmDialog,
  DataState,
  DataTable,
  PageHeader,
  RowAction,
  StatusBadge,
  describeError,
  useToast,
  type Column,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useCompanies, useDeleteCompany, useSaveCompany } from '@/features/insurance-data/insurance-data.api';
import type { CompanyDto } from '@aggregator/shared';

export function CompaniesPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const companies = useCompanies();
  const deleteCompany = useDeleteCompany();
  const [pendingDelete, setPendingDelete] = useState<CompanyDto | null>(null);

  const columns: Column<CompanyDto>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (company) => (
        <div className="flex items-center gap-3">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt=""
              className="bg-surface-muted size-8 shrink-0 rounded object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-surface-muted text-content-subtle flex size-8 shrink-0 items-center justify-center rounded text-xs font-semibold"
            >
              {company.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="text-content font-medium">{company.name}</span>
        </div>
      ),
    },
    {
      key: 'shortName',
      header: 'Short name',
      render: (company) => company.shortName ?? '—',
      hideOnMobile: true,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (company) => company.email ?? company.phone ?? '—',
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (company) => <StatusBadge isActive={company.isActive} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Companies"
        description="Insurance companies whose plans are stored in the system."
        actions={<ButtonLink to={ROUTES.companies.new}>+ Add company</ButtonLink>}
      />

      <DataState
        isLoading={companies.isLoading}
        error={companies.error}
        data={companies.data}
        subject="insurance companies"
        onRetry={() => void companies.refetch()}
        empty={{
          title: 'No insurance companies yet',
          description:
            'Add your first insurance company to start building the insurance database.',
          action: <ButtonLink to={ROUTES.companies.new}>+ Add company</ButtonLink>,
        }}
      >
        {(items) => (
          <DataTable
            columns={columns}
            items={items}
            getRowKey={(company) => company.id}
            actions={(company) => (
              <CompanyRowActions
                company={company}
                onEdit={() => navigate(ROUTES.companies.edit(company.id))}
                onDelete={() => setPendingDelete(company)}
              />
            )}
          />
        )}
      </DataState>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteCompany.isPending}
        title={`Delete ${pendingDelete?.name ?? 'company'}?`}
        description="This permanently removes the company. If it already has plans, the system will refuse — deactivate it instead so existing plans keep working."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteCompany.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify(`${pendingDelete.name} was deleted.`);
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the company'), 'error');
              setPendingDelete(null);
            },
          });
        }}
      />
    </>
  );
}

/** Edit, activate/deactivate and delete for one row. */
function CompanyRowActions({
  company,
  onEdit,
  onDelete,
}: {
  company: CompanyDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { notify } = useToast();
  const save = useSaveCompany(company.id);

  return (
    <div className="flex justify-end gap-1">
      <RowAction onClick={onEdit}>Edit</RowAction>
      <RowAction
        disabled={save.isPending}
        onClick={() =>
          save.mutate(
            { isActive: !company.isActive },
            {
              onSuccess: () =>
                notify(
                  `${company.name} is now ${company.isActive ? 'inactive' : 'active'}.`,
                ),
              onError: (error) => notify(describeError(error, 'the company'), 'error'),
            },
          )
        }
      >
        {company.isActive ? 'Deactivate' : 'Activate'}
      </RowAction>
      <RowAction tone="danger" onClick={onDelete}>
        Delete
      </RowAction>
    </div>
  );
}
