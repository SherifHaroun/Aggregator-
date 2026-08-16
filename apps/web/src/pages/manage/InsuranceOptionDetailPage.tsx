import {
  OPTION_FIELD_DATA_TYPES,
  listEnabledOptions,
  type OptionFieldDataType,
  type OptionFieldDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  StatusToggle,
  Textarea,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useCreateOptionField,
  useDeleteOptionField,
  useInsuranceOption,
  useSaveInsuranceOption,
  useUpdateOptionField,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/** Data types come from the shared configuration, never a list retyped here. */
const DATA_TYPES = listEnabledOptions(OPTION_FIELD_DATA_TYPES);

/**
 * One benefit and the fields it requires.
 *
 * Whatever fields the employee defines here become the inputs rendered on every
 * plan configuration that uses this benefit.
 */
export function InsuranceOptionDetailPage() {
  const { optionId } = useParams();
  const { notify } = useToast();
  const option = useInsuranceOption(optionId);
  const saveOption = useSaveInsuranceOption(optionId);
  const deleteField = useDeleteOptionField();

  const [editingField, setEditingField] = useState<OptionFieldDto | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<OptionFieldDto | null>(null);

  const fields = option.data?.fields ?? [];

  return (
    <>
      <PageHeader
        title={option.data?.name ?? 'Insurance option'}
        description={option.data?.description ?? undefined}
        actions={
          option.data ? (
            <Button
              variant="secondary"
              disabled={saveOption.isPending}
              onClick={() =>
                saveOption.mutate(
                  { isActive: !option.data!.isActive },
                  {
                    onSuccess: () => notify('The option was updated.'),
                    onError: (error) => notify(describeError(error, 'the option'), 'error'),
                  },
                )
              }
            >
              {option.data.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Link
          to={ROUTES.insuranceOptions.list}
          className="text-content-muted hover:text-content text-sm"
        >
          ← All insurance options
        </Link>
      </div>

      <DataState
        isLoading={option.isLoading}
        error={option.error}
        data={option.data ? [option.data] : undefined}
        subject="the insurance option"
        onRetry={() => void option.refetch()}
        empty={{ title: 'Option not found' }}
      >
        {([current]) => (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Option details"
                action={<StatusBadge isActive={current!.isActive} />}
              />
              <CardBody>
                <OptionDetailsForm option={current!} />
              </CardBody>
            </Card>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-content text-lg font-semibold">Fields</h2>
                  <p className="text-content-muted text-sm">
                    The information this benefit requires. Every plan configuration using it will be
                    asked for exactly these.
                  </p>
                </div>
                <Button onClick={() => setEditingField(null)}>+ Add field</Button>
              </div>

              {fields.length === 0 ? (
                <EmptyState
                  title="No fields yet"
                  description="Add the pieces of information this benefit needs, such as a coverage percentage or a limit."
                  action={<Button onClick={() => setEditingField(null)}>+ Add field</Button>}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <Card key={field.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-content font-medium">{field.label}</p>
                          <p className="text-content-subtle mt-0.5 text-xs">
                            <code>{field.key}</code>
                          </p>
                        </div>
                        {field.isRequired ? <Badge tone="brand">Required</Badge> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge>{dataTypeLabel(field.dataType)}</Badge>
                        {field.unit ? <Badge>{field.unit}</Badge> : null}
                      </div>

                      <div className="mt-4 flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingField(field)}
                          className="text-content-muted hover:text-content hover:bg-surface-muted rounded-(--radius-control) px-2.5 py-1.5 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(field)}
                          className="text-danger hover:bg-danger-soft rounded-(--radius-control) px-2.5 py-1.5 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DataState>

      {editingField !== undefined && optionId ? (
        <OptionFieldDialog
          optionId={optionId}
          field={editingField}
          onClose={() => setEditingField(undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        busy={deleteField.isPending}
        title={`Delete ${pendingDelete?.label ?? 'field'}?`}
        description="This permanently removes the field. If any plan configuration has already supplied a value for it, the system will refuse — deactivate the field instead."
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteField.mutate(pendingDelete.id, {
            onSuccess: () => {
              notify(`${pendingDelete.label} was deleted.`);
              setPendingDelete(null);
            },
            onError: (error) => {
              notify(describeError(error, 'the field'), 'error');
              setPendingDelete(null);
            },
          });
        }}
      />
    </>
  );
}

function dataTypeLabel(dataType: OptionFieldDataType): string {
  return OPTION_FIELD_DATA_TYPES[dataType]?.label ?? dataType;
}

/** Inline edit of the option's own details. */
function OptionDetailsForm({
  option,
}: {
  option: NonNullable<ReturnType<typeof useInsuranceOption>['data']>;
}) {
  const { notify } = useToast();
  const save = useSaveInsuranceOption(option.id);
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: option.name,
    description: option.description ?? '',
    isActive: option.isActive,
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          {
            name: values.name.trim(),
            description: values.description.trim() === '' ? null : values.description.trim(),
            isActive: values.isActive,
          },
          {
            onSuccess: () => notify('The option was saved.'),
            onError: (error) => applyError(error, 'the option'),
          },
        );
      }}
    >
      {formError ? (
        <Callout tone="danger" className="mb-4" title="Could not save">
          {formError}
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Option name" required error={fieldErrors.name}>
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
        <div className="sm:col-span-2">
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
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save details'}
        </Button>
      </div>
    </form>
  );
}

/** Create or edit one field definition. `field === null` means "create". */
function OptionFieldDialog({
  optionId,
  field,
  onClose,
}: {
  optionId: string;
  field: OptionFieldDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const create = useCreateOptionField(optionId);
  const update = useUpdateOptionField();
  const pending = create.isPending || update.isPending;

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    label: field?.label ?? '',
    dataType: (field?.dataType ?? 'NUMBER') as OptionFieldDataType,
    unit: field?.unit ?? '',
    helpText: field?.helpText ?? '',
    isRequired: field?.isRequired ?? false,
    isActive: field?.isActive ?? true,
  });

  function submit() {
    const payload = {
      label: values.label.trim(),
      dataType: values.dataType,
      unit: values.unit.trim() === '' ? null : values.unit.trim(),
      helpText: values.helpText.trim() === '' ? null : values.helpText.trim(),
      isRequired: values.isRequired,
      isActive: values.isActive,
    };

    const handlers = {
      onSuccess: () => {
        notify('The field was saved.');
        onClose();
      },
      onError: (error: unknown) => applyError(error, 'the field'),
    };

    if (field) {
      update.mutate({ fieldId: field.id, input: payload }, handlers);
    } else {
      create.mutate(payload, handlers);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={field ? 'Edit field' : 'Add field'}
      description="Define one piece of information this benefit requires."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Save field'}
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

        <Field label="Field label" required error={fieldErrors.label}>
          {(props) => (
            <Input
              {...props}
              value={values.label}
              onChange={(event) => setValue('label', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Data type"
          required
          error={fieldErrors.dataType}
          hint={
            field
              ? 'Cannot be changed once configurations have supplied values for this field.'
              : undefined
          }
        >
          {(props) => (
            <Select
              {...props}
              value={values.dataType}
              onChange={(event) => setValue('dataType', event.target.value as OptionFieldDataType)}
            >
              {DATA_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Unit" error={fieldErrors.unit} hint="Optional, e.g. sessions or months.">
          {(props) => (
            <Input
              {...props}
              value={values.unit}
              onChange={(event) => setValue('unit', event.target.value)}
            />
          )}
        </Field>

        <Field label="Help text" error={fieldErrors.helpText}>
          {(props) => (
            <Input
              {...props}
              value={values.helpText}
              onChange={(event) => setValue('helpText', event.target.value)}
            />
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isRequired}
            onChange={(event) => setValue('isRequired', event.target.checked)}
            className="accent-brand size-4"
          />
          Every configuration must supply this value
        </label>
      </div>
    </Dialog>
  );
}
