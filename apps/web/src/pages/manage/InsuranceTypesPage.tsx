import { useState } from 'react';
import {
  Button,
  Callout,
  ConfirmDialog,
  DataState,
  DataTable,
  Dialog,
  Field,
  Input,
  PageHeader,
  RowAction,
  StatusBadge,
  StatusToggle,
  Textarea,
  describeError,
  useToast,
  type Column,
} from '@/components/ui';
import {
  useDeleteInsuranceType,
  useInsuranceTypes,
  useSaveInsuranceType,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';
import type { InsuranceTypeDto } from '@aggregator/shared';

/**
 * Insurance types are database records, never a hardcoded list. Whatever the
 * employee creates here becomes available when creating plans and options.
 */
export function InsuranceTypesPage() {
  const { notify } = useToast();
  const types = useInsuranceTypes();
  const deleteType = useDeleteInsuranceType();

  const [editing, setEditing] = useState<InsuranceTypeDto | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<InsuranceTypeDto | null>(null);

  const columns: Column<InsuranceTypeDto>[] = [
    {
      key: 'name',
      header: 'Insurance type',
      render: (type) => (
        <div>
          <p className="text-content font-medium">{type.name}</p>
          {type.description ? (
            <p className="text-content-muted mt-0.5 line-clamp-1 text-sm">{type.description}</p>
          ) : null}
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (type) => <code className="text-xs">{type.code}</code>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (type) => <StatusBadge isActive={type.isActive} /> },
  ];

  return (
    <>
      <PageHeader
        title="Insurance types"
        description="Categories of insurance. Plans and options are grouped under these."
        actions={<Button onClick={() => setEditing(null)}>+ Add insurance type</Button>}
      />

      <DataState
        isLoading={types.isLoading}
        error={types.error}
        data={types.data}
        subject="insurance types"
        onRetry={() => void types.refetch()}
        empty={{
          title: 'No insurance types yet',
          description:
            'Create your first insurance type — for example the category of insurance your company sells — so plans and options can be grouped under it.',
          action: <Button onClick={() => setEditing(null)}>+ Add insurance type</Button>,
        }}
      >
        {(items) => (
          <DataTable
            columns={columns}
            items={items}
            getRowKey={(type) => type.id}
            actions={(type) => (
              <div className="flex justify-end gap-1">
                <RowAction onClick={() => setEditing(type)}>Edit</RowAction>
                <RowAction tone="danger" onClick={() => setPendingDelete(type)}>
                  Delete
                </RowAction>
              </div>
            )}
          />
        )}
      </DataState>

      {editing !== undefined ? (
        <InsuranceTypeDialog insuranceType={editing} onClose={() => setEditing(undefined)} />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteType.isPending}
        title={`Delete ${pendingDelete?.name ?? 'insurance type'}?`}
        description="This permanently removes the insurance type. If plans or options already use it, the system will refuse — deactivate it instead."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteType.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify(`${pendingDelete.name} was deleted.`);
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the insurance type'), 'error');
              setPendingDelete(null);
            },
          });
        }}
      />
    </>
  );
}

/** Create or edit dialog. `insuranceType === null` means "create". */
function InsuranceTypeDialog({
  insuranceType,
  onClose,
}: {
  insuranceType: InsuranceTypeDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const save = useSaveInsuranceType(insuranceType?.id);
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: insuranceType?.name ?? '',
    description: insuranceType?.description ?? '',
    isActive: insuranceType?.isActive ?? true,
  });

  function submit() {
    save.mutate(
      {
        name: values.name.trim(),
        description: values.description.trim() === '' ? null : values.description.trim(),
        isActive: values.isActive,
      },
      {
        onSuccess: (saved) => {
          notify(`${saved.name} was saved.`);
          onClose();
        },
        onError: (error) => applyError(error, 'the insurance type'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={insuranceType ? 'Edit insurance type' : 'Add insurance type'}
      description="Insurance types are records — create whichever categories your company sells."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
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

        <Field label="Insurance type name" required error={fieldErrors.name}>
          {(props) => (
            <Input
              {...props}
              value={values.name}
              onChange={(event) => setValue('name', event.target.value)}
            />
          )}
        </Field>

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
