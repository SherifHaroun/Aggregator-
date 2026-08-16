import type { OptionFieldDataType, PlanOptionDto, PlanOptionValueInput } from '@aggregator/shared';
import { useEffect, useState } from 'react';
import {
  Button,
  Callout,
  Field,
  Input,
  InputWithSuffix,
  Select,
  describeError,
  useToast,
} from '@/components/ui';
import { useSavePlanOptionValues } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Renders the inputs for ONE option attached to ONE configuration.
 *
 * The form is generated entirely from the option's field definitions, which the
 * API returns alongside each value. There is no branching on option names
 * anywhere — an option invented by an employee this morning renders exactly the
 * same way as any other.
 */
export function PlanOptionValuesForm({ planOption }: { planOption: PlanOptionDto }) {
  const { notify } = useToast();
  const save = useSavePlanOptionValues();

  // Values are edited as strings, then converted per data type on submit.
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(planOption));
  // Keyed by the field's stable `key`, which is what the API reports errors against.
  const { fieldErrors, formError, applyError, clearErrors } = useRecordForm<Record<string, string>>({});

  // Re-sync when the server sends new values (e.g. after a refetch).
  useEffect(() => setDraft(toDraft(planOption)), [planOption]);

  if (planOption.values.length === 0) {
    return (
      <p className="text-content-subtle text-sm">
        This benefit has no fields defined yet. Add fields to it from the Insurance options screen.
      </p>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearErrors();

    const values: PlanOptionValueInput[] = planOption.values.map((value) => ({
      optionFieldId: value.optionFieldId,
      value: parseValue(value.dataType, draft[value.optionFieldId] ?? ''),
    }));

    save.mutate(
      { planOptionId: planOption.id, values },
      {
        onSuccess: () => notify(`${planOption.optionName} was saved.`),
        onError: (error) => {
          applyError(error, 'the values');
          notify(describeError(error, 'the values'), 'error');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError ? (
        <Callout tone="danger" title="Could not save">
          {formError}
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {planOption.values.map((value) => (
          <Field
            key={value.optionFieldId}
            label={value.fieldLabel}
            error={fieldErrors[value.fieldKey]}
          >
            {(props) => (
              <ValueInput
                {...props}
                dataType={value.dataType}
                unit={value.unit}
                value={draft[value.optionFieldId] ?? ''}
                onChange={(next) =>
                  setDraft((current) => ({ ...current, [value.optionFieldId]: next }))
                }
              />
            )}
          </Field>
        ))}
      </div>

      <div className="flex justify-end">
        {/* Named per benefit: a configuration shows one Save button per benefit. */}
        <Button
          type="submit"
          size="sm"
          disabled={save.isPending}
          aria-label={`Save ${planOption.optionName}`}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

/**
 * One input, chosen purely by the field's data type.
 * Add a data type to the backend and this is the only place the UI needs to learn it.
 */
function ValueInput({
  dataType,
  unit,
  value,
  onChange,
  ...props
}: {
  dataType: OptionFieldDataType;
  unit: string | null;
  value: string;
  onChange: (value: string) => void;
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}) {
  switch (dataType) {
    case 'BOOLEAN':
      return (
        <Select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Not set</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      );

    case 'TEXT':
      return <Input {...props} value={value} onChange={(event) => onChange(event.target.value)} />;

    case 'PERCENTAGE':
      return (
        <InputWithSuffix
          {...props}
          type="number"
          min={0}
          max={100}
          step="0.01"
          suffix={unit ?? '%'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'CURRENCY':
    case 'NUMBER':
    default:
      return unit ? (
        <InputWithSuffix
          {...props}
          type="number"
          step="0.01"
          suffix={unit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...props}
          type="number"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

function toDraft(planOption: PlanOptionDto): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const value of planOption.values) {
    draft[value.optionFieldId] = value.value === null ? '' : String(value.value);
  }
  return draft;
}

/** Convert the edited string back to the type the API expects. */
function parseValue(dataType: OptionFieldDataType, raw: string): number | string | boolean | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  switch (dataType) {
    case 'BOOLEAN':
      return trimmed === 'true';
    case 'TEXT':
      return trimmed;
    default: {
      const parsed = Number(trimmed);
      // Let the API reject a non-number so its message is the single source.
      return Number.isNaN(parsed) ? trimmed : parsed;
    }
  }
}
