import {
  parseOptionValue,
  type OptionFieldDataType,
  type PlanOptionDto,
  type PlanOptionValueDto,
  type PlanOptionValueInput,
} from '@aggregator/shared';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Callout,
  Field,
  Input,
  NumberInput,
  Select,
  describeError,
  useToast,
} from '@/components/ui';
import {
  useSavePlanOptionNote,
  useSavePlanOptionValue,
  useSavePlanOptionValues,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/** Quiet period after the last keystroke before the value is sent. */
const SAVE_DEBOUNCE_MS = 600;
/** How long "Saved ✓" stays on screen. */
const SAVED_VISIBLE_MS = 2000;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The value a benefit takes inside ONE configuration: one inline control that
 * saves itself.
 *
 * There is no Save button. Editing schedules a save, rapid edits collapse into
 * a single request, and the response is written straight into the query cache —
 * nothing is refetched and no other row is touched.
 *
 * Every prop is a primitive so `memo` can hold this component still while the
 * row above it rerenders on each pointer move of a drag. That is what keeps
 * dragging cheap: the expensive part of a benefit row does not participate.
 */
export const PlanOptionValueInline = memo(function PlanOptionValueInline({
  planOptionId,
  planConfigurationId,
  optionName,
  optionFieldId,
  dataType,
  unit,
  value,
  disabled = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  optionFieldId: string;
  dataType: OptionFieldDataType;
  unit: string | null;
  /** The saved value, as text. */
  value: string;
  /** True while the row itself is still being created. */
  disabled?: boolean;
}) {
  const save = useSavePlanOptionValue();
  const [text, setText] = useState(value);
  const [state, setState] = useState<SaveState>('idle');

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Set while an edit is on its way to the server, so the saved value coming
   *  back from elsewhere never overwrites what the employee is typing. */
  const dirty = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Accept the server's value only when the employee has nothing in flight.
  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);

  const commit = useCallback(
    (next: string) => {
      clearTimeout(timer.current);
      setState('saving');
      save.mutate(
        {
          planOptionId,
          planConfigurationId,
          optionFieldId,
          value: parseOptionValue(dataType, next),
        },
        {
          onSuccess: () => {
            dirty.current = false;
            setState('saved');
          },
          // The employee's value stays on screen; the error invites a retry.
          onError: () => setState('error'),
        },
      );
    },
    [dataType, optionFieldId, planConfigurationId, planOptionId, save],
  );

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      dirty.current = true;
      setState('idle');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(next), SAVE_DEBOUNCE_MS);
    },
    [commit],
  );

  /** Leaving the field should not cost the employee another wait. */
  const handleBlur = useCallback(() => {
    if (dirty.current && state !== 'saving') commit(text);
  }, [commit, state, text]);

  // Let "Saved ✓" fade out on its own.
  useEffect(() => {
    if (state !== 'saved') return;
    const done = setTimeout(() => setState('idle'), SAVED_VISIBLE_MS);
    return () => clearTimeout(done);
  }, [state]);

  return (
    <span className="flex items-center gap-2">
      <span className="w-32">
        <ValueInput
          dataType={dataType}
          unit={unit}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-label={`${optionName} value`}
        />
      </span>

      <SaveStatus state={state} optionName={optionName} onRetry={() => commit(text)} />
    </span>
  );
});

/** Fixed width, so a row never moves as the state changes under it. */
function SaveStatus({
  state,
  optionName,
  onRetry,
}: {
  state: SaveState;
  optionName: string;
  onRetry: () => void;
}) {
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        aria-label={`Retry saving ${optionName}`}
        className="text-danger hover:bg-danger-soft w-16 shrink-0 rounded-(--radius-control) px-1 py-0.5 text-left text-xs font-semibold"
      >
        Retry
      </button>
    );
  }

  return (
    <span aria-live="polite" className="text-content-subtle w-16 shrink-0 text-xs">
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : null}
    </span>
  );
}

/**
 * Renders the inputs for a benefit that carries MORE THAN ONE value.
 *
 * The form is generated entirely from the benefit's field definitions, which the
 * API returns alongside each value. There is no branching on benefit names
 * anywhere. Nothing in the product creates such a benefit any more; records
 * made before the percentage-only workflow keep their explicit Save, because a
 * set of mixed-type fields is edited as one unit rather than field by field.
 */
export function PlanOptionValuesForm({ planOption }: { planOption: PlanOptionDto }) {
  const { notify } = useToast();
  const save = useSavePlanOptionValues();

  // Values are edited as strings, then converted per data type on submit.
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(planOption));
  // Keyed by the field's stable `key`, which is what the API reports errors against.
  const { fieldErrors, formError, applyError, clearErrors } = useRecordForm<Record<string, string>>(
    {},
  );

  // Re-sync when the server sends new values (e.g. after a refetch).
  useEffect(() => setDraft(toDraft(planOption)), [planOption]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearErrors();

    const values: PlanOptionValueInput[] = planOption.values.map((value) => ({
      optionFieldId: value.optionFieldId,
      value: parseOptionValue(value.dataType, draft[value.optionFieldId] ?? ''),
    }));

    save.mutate(
      {
        planOptionId: planOption.id,
        planConfigurationId: planOption.planConfigurationId,
        values,
      },
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
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
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
      return <NumberInput {...props} suffix={unit ?? '%'} value={value} onChange={onChange} />;

    /**
     * A limit is the figure most likely to have five digits in it, so it is
     * grouped as it is typed — 100,000, never 100000 counted by eye. The value
     * that leaves the control is still the plain number.
     */
    case 'CURRENCY':
    case 'NUMBER':
    default:
      return (
        <NumberInput
          {...props}
          {...(unit ? { suffix: unit } : {})}
          value={value}
          onChange={onChange}
        />
      );
  }
}

/** The saved value as editable text. Exported so a row can pass a primitive. */
export const valueAsText = (value: PlanOptionValueDto): string =>
  value.value === null ? '' : String(value.value);

function toDraft(planOption: PlanOptionDto): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const value of planOption.values) {
    draft[value.optionFieldId] = valueAsText(value);
  }
  return draft;
}

/**
 * The remark beside a benefit's value on ONE configuration — "1 in 10 members
 * ratio", "basic procedures only".
 *
 * Saves itself exactly as a value does, for the same reason: an employee
 * qualifying thirty figures should never hunt for a Save button. It is offered
 * on every benefit, because any figure may need qualifying, but it stays out of
 * the way until it is asked for.
 */
export const PlanOptionNoteInline = memo(function PlanOptionNoteInline({
  planOptionId,
  planConfigurationId,
  optionName,
  note,
  disabled = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  /** The saved note, or `null` when none was written. */
  note: string | null;
  disabled?: boolean;
}) {
  const save = useSavePlanOptionNote();
  const [text, setText] = useState(note ?? '');
  const [open, setOpen] = useState(note !== null);
  const [state, setState] = useState<SaveState>('idle');

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!dirty.current) setText(note ?? '');
  }, [note]);

  const commit = useCallback(
    (next: string) => {
      clearTimeout(timer.current);
      setState('saving');
      save.mutate(
        {
          planOptionId,
          planConfigurationId,
          // Cleared text removes the note rather than storing an empty one.
          note: next.trim() === '' ? null : next.trim(),
        },
        {
          onSuccess: () => {
            dirty.current = false;
            setState('saved');
          },
          onError: () => setState('error'),
        },
      );
    },
    [planConfigurationId, planOptionId, save],
  );

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      dirty.current = true;
      setState('idle');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(next), SAVE_DEBOUNCE_MS);
    },
    [commit],
  );

  useEffect(() => {
    if (state !== 'saved') return;
    const done = setTimeout(() => setState('idle'), SAVED_VISIBLE_MS);
    return () => clearTimeout(done);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={`Add a note to ${optionName}`}
        className="text-content-subtle hover:text-brand-strong hover:bg-brand-soft w-fit rounded-(--radius-control) px-1.5 py-0.5 text-xs font-medium"
      >
        + Note
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Input
        autoFocus={note === null}
        value={text}
        disabled={disabled}
        aria-label={`${optionName} note`}
        placeholder="e.g. 1 in 10 members ratio"
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          if (dirty.current && state !== 'saving') commit(text);
          // An empty note that was never written folds the field away again.
          if (text.trim() === '' && note === null) setOpen(false);
        }}
        className="py-1.5 text-xs"
      />
      <SaveStatus state={state} optionName={`${optionName} note`} onRetry={() => commit(text)} />
    </span>
  );
});
