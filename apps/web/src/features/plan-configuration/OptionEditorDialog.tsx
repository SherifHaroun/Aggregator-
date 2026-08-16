import {
  OPTION_FIELD_DATA_TYPES,
  listEnabledOptions,
  type InsuranceOptionDto,
  type OptionFieldDataType,
  type OptionFieldDto,
} from '@aggregator/shared';
import { useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Field,
  IconAdd,
  IconEdit,
  IconTrash,
  Input,
  Select,
  StatusToggle,
  describeError,
  useToast,
} from '@/components/ui';
import {
  useCreateOptionField,
  useDeleteOptionField,
  useSaveInsuranceOption,
  useUpdateOptionField,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/** Field types come from the shared configuration, never a list retyped here. */
const DATA_TYPES = listEnabledOptions(OPTION_FIELD_DATA_TYPES);

interface DraftField {
  label: string;
  dataType: OptionFieldDataType;
}

/**
 * Create or edit a benefit and the information it requires.
 *
 * This is the whole dynamic-options story in one place: an employee invents a
 * benefit, gives it whatever fields it needs, and every plan configuration that
 * uses it is then asked for exactly those. No benefit name or field is known to
 * the code.
 */
export function OptionEditorDialog({
  insuranceTypeId,
  option,
  onClose,
}: {
  insuranceTypeId: string;
  /** `null` creates a new option. */
  option: InsuranceOptionDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const saveOption = useSaveInsuranceOption(option?.id);

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: option?.name ?? '',
    description: option?.description ?? '',
    isActive: option?.isActive ?? true,
  });

  // Fields for a NEW option are collected locally and sent with the option.
  const [drafts, setDrafts] = useState<DraftField[]>([]);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftType, setDraftType] = useState<OptionFieldDataType>('PERCENTAGE');

  function addDraft() {
    if (draftLabel.trim() === '') return;
    setDrafts((current) => [...current, { label: draftLabel.trim(), dataType: draftType }]);
    setDraftLabel('');
  }

  function submit() {
    saveOption.mutate(
      {
        name: values.name.trim(),
        description: values.description.trim() === '' ? null : values.description.trim(),
        isActive: values.isActive,
        ...(option ? {} : { insuranceTypeId, fields: drafts }),
      },
      {
        onSuccess: (saved) => {
          notify(`${saved.name} was saved.`);
          onClose();
        },
        onError: (error) => applyError(error, 'the benefit'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={option ? 'Edit benefit' : 'Create a benefit'}
      description="Define the benefit and the information every plan must supply for it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saveOption.isPending}>
            {option ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={submit} disabled={saveOption.isPending}>
            {saveOption.isPending ? 'Saving…' : option ? 'Save benefit' : 'Create benefit'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError ? (
          <Callout tone="danger" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <Field label="Benefit name" required error={fieldErrors.name}>
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={values.name}
              onChange={(event) => setValue('name', event.target.value)}
              placeholder="Name this benefit"
            />
          )}
        </Field>

        <Field label="Description" error={fieldErrors.description} hint="Optional.">
          {(props) => (
            <Input
              {...props}
              value={values.description}
              onChange={(event) => setValue('description', event.target.value)}
            />
          )}
        </Field>

        {option ? (
          <Field label="Status" error={fieldErrors.isActive}>
            {(props) => (
              <StatusToggle
                id={props.id}
                value={values.isActive}
                onChange={(isActive) => setValue('isActive', isActive)}
              />
            )}
          </Field>
        ) : null}

        <div className="border-border-subtle border-t pt-5">
          <h3 className="text-content text-sm font-semibold">Fields</h3>
          <p className="text-content-muted mt-1 text-xs">
            Every plan configuration using this benefit will be asked for exactly these.
          </p>

          <div className="mt-3 space-y-2">
            {option
              ? (option.fields ?? []).map((field) => (
                  <ExistingFieldRow key={field.id} field={field} />
                ))
              : drafts.map((draft, index) => (
                  <div
                    key={`${draft.label}-${index}`}
                    className="border-border-subtle flex items-center gap-2 rounded-(--radius-control) border px-3 py-2"
                  >
                    <span className="text-content min-w-0 flex-1 truncate text-sm font-medium">
                      {draft.label}
                    </span>
                    <Badge tone="brand">
                      {OPTION_FIELD_DATA_TYPES[draft.dataType]?.label ?? draft.dataType}
                    </Badge>
                    <button
                      type="button"
                      aria-label={`Remove ${draft.label}`}
                      onClick={() => setDrafts((c) => c.filter((_, i) => i !== index))}
                      className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-1.5"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </div>
                ))}

            {(option ? (option.fields?.length ?? 0) : drafts.length) === 0 ? (
              <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-4 text-center text-xs">
                No fields yet. Add the information this benefit needs.
              </p>
            ) : null}
          </div>

          <AddFieldRow
            optionId={option?.id ?? null}
            label={draftLabel}
            dataType={draftType}
            onLabel={setDraftLabel}
            onDataType={setDraftType}
            onAddLocal={addDraft}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** An already-saved field: rename, retype (when unused), or remove. */
function ExistingFieldRow({ field }: { field: OptionFieldDto }) {
  const { notify } = useToast();
  const update = useUpdateOptionField();
  const remove = useDeleteOptionField();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [dataType, setDataType] = useState<OptionFieldDataType>(field.dataType);

  if (editing) {
    return (
      <div className="border-brand-border bg-brand-soft/40 flex flex-wrap items-center gap-2 rounded-(--radius-control) border px-3 py-2">
        <Input
          className="min-w-0 flex-1"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label={`Rename ${field.label}`}
        />
        <Select
          className="w-auto"
          value={dataType}
          onChange={(event) => setDataType(event.target.value as OptionFieldDataType)}
          aria-label={`Type of ${field.label}`}
        >
          {DATA_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { fieldId: field.id, input: { label: label.trim(), dataType } },
              {
                onSuccess: () => {
                  notify('The field was saved.');
                  setEditing(false);
                },
                onError: (error) => notify(describeError(error, 'the field'), 'error'),
              },
            )
          }
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border-subtle flex items-center gap-2 rounded-(--radius-control) border px-3 py-2">
      <span className="text-content min-w-0 flex-1 truncate text-sm font-medium">{field.label}</span>
      <Badge tone="brand">{OPTION_FIELD_DATA_TYPES[field.dataType]?.label ?? field.dataType}</Badge>
      <button
        type="button"
        aria-label={`Edit ${field.label}`}
        onClick={() => setEditing(true)}
        className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-1.5"
      >
        <IconEdit className="size-4" />
      </button>
      <button
        type="button"
        aria-label={`Remove ${field.label}`}
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(field.id, {
            onSuccess: () => notify(`${field.label} was removed.`),
            onError: (error) => notify(describeError(error, 'the field'), 'error'),
          })
        }
        className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-1.5"
      >
        <IconTrash className="size-4" />
      </button>
    </div>
  );
}

/** The "add a field" row — writes straight to the API when the option exists. */
function AddFieldRow({
  optionId,
  label,
  dataType,
  onLabel,
  onDataType,
  onAddLocal,
}: {
  optionId: string | null;
  label: string;
  dataType: OptionFieldDataType;
  onLabel: (value: string) => void;
  onDataType: (value: OptionFieldDataType) => void;
  onAddLocal: () => void;
}) {
  const { notify } = useToast();
  const create = useCreateOptionField(optionId ?? '');

  function add() {
    if (label.trim() === '') return;
    if (!optionId) {
      onAddLocal();
      return;
    }
    create.mutate(
      { label: label.trim(), dataType },
      {
        onSuccess: () => {
          notify('The field was added.');
          onLabel('');
        },
        onError: (error) => notify(describeError(error, 'the field'), 'error'),
      },
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label="New field">
          {(props) => (
            <Input
              {...props}
              value={label}
              onChange={(event) => onLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="What information does this benefit need?"
            />
          )}
        </Field>
      </div>
      <div className="w-40">
        <Field label="Type">
          {(props) => (
            <Select
              {...props}
              value={dataType}
              onChange={(event) => onDataType(event.target.value as OptionFieldDataType)}
            >
              {DATA_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button variant="soft" onClick={add} disabled={create.isPending || label.trim() === ''}>
        <IconAdd className="size-4" />
        Add
      </Button>
    </div>
  );
}
