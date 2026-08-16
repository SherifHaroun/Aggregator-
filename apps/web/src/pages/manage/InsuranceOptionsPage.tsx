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
import {
  useDeleteInsuranceOption,
  useInsuranceOptions,
  useInsuranceTypes,
} from '@/features/insurance-data/insurance-data.api';
import type { InsuranceOptionDto } from '@aggregator/shared';

/**
 * The benefit catalogue. Every entry is created by an employee — the
 * application ships with none and knows none by name.
 */
export function InsuranceOptionsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const options = useInsuranceOptions();
  const insuranceTypes = useInsuranceTypes();
  const deleteOption = useDeleteInsuranceOption();
  const [pendingDelete, setPendingDelete] = useState<InsuranceOptionDto | null>(null);

  const typeName = new Map((insuranceTypes.data ?? []).map((type) => [type.id, type.name]));
  const canCreate = (insuranceTypes.data?.length ?? 0) > 0;

  const columns: Column<InsuranceOptionDto>[] = [
    {
      key: 'name',
      header: 'Benefit',
      render: (option) => (
        <div>
          <p className="text-content font-medium">{option.name}</p>
          {option.description ? (
            <p className="text-content-muted mt-0.5 line-clamp-1 text-sm">{option.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'insuranceType',
      header: 'Insurance type',
      render: (option) => typeName.get(option.insuranceTypeId) ?? '—',
      hideOnMobile: true,
    },
    {
      key: 'fields',
      header: 'Fields',
      render: (option) => `${option.fields?.length ?? 0} fields`,
    },
    { key: 'status', header: 'Status', render: (option) => <StatusBadge isActive={option.isActive} /> },
  ];

  return (
    <>
      <PageHeader
        title="Insurance options"
        description="Benefits that can be added to plan configurations. Each defines the information it requires."
        actions={canCreate ? <ButtonLink to={ROUTES.insuranceOptions.new}>+ Add option</ButtonLink> : undefined}
      />

      <DataState
        isLoading={options.isLoading}
        error={options.error}
        data={options.data}
        subject="insurance options"
        onRetry={() => void options.refetch()}
        empty={{
          title: 'No insurance options yet',
          description: canCreate
            ? 'Create your first benefit and define the information it needs — coverage, limits, or anything else.'
            : 'Create an insurance type first — every benefit belongs to one.',
          action: canCreate ? (
            <ButtonLink to={ROUTES.insuranceOptions.new}>+ Add option</ButtonLink>
          ) : undefined,
        }}
      >
        {(items) => (
          <DataTable
            columns={columns}
            items={items}
            getRowKey={(option) => option.id}
            actions={(option) => (
              <div className="flex justify-end gap-1">
                <RowAction onClick={() => navigate(ROUTES.insuranceOptions.detail(option.id))}>
                  Configure
                </RowAction>
                <RowAction tone="danger" onClick={() => setPendingDelete(option)}>
                  Delete
                </RowAction>
              </div>
            )}
          />
        )}
      </DataState>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteOption.isPending}
        title={`Delete ${pendingDelete?.name ?? 'option'}?`}
        description="This permanently removes the benefit and its field definitions. If any plan configuration already uses it, the system will refuse — deactivate it instead."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteOption.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify(`${pendingDelete.name} was deleted.`);
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the option'), 'error');
              setPendingDelete(null);
            },
          });
        }}
      />
    </>
  );
}
