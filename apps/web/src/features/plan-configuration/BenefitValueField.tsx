import { OPTION_FIELD_DATA_TYPES, type OptionFieldDto } from '@aggregator/shared';
import { Input, NumberInput, Select } from '@/components/ui';

/**
 * What a value is while it is being edited: always a string, whatever the
 * field's real type. A half-typed number is not a number, and forcing it to be
 * one mid-keystroke is how "1" becomes 1 and then refuses "1." on the way to
 * "1.5". It is converted once, on save.
 *
 * MULTI is the exception — a set of ticked answers has no string form — so it
 * is carried as the list of choice ids.
 */
export type DraftValue = string | string[];

/** Whether a field's storage is a number, so the input can group as it types. */
const isNumeric = (field: OptionFieldDto) =>
  OPTION_FIELD_DATA_TYPES[field.dataType].storage === 'NUMBER';

/**
 * ONE INPUT, DRAWN FROM THE FIELD THE CATALOGUE ACTUALLY DEFINES.
 *
 * The control is never assumed. A benefit holding a percentage gets a number
 * box with a % suffix; one holding wording gets a text box; one holding a
 * ranked answer gets that answer's own list. Typing "covered at authorized
 * centres" into a box that only takes figures is how a save used to fail after
 * a screenful of work, and the fix is to ask the catalogue rather than guess.
 */
export function BenefitValueField({
  field,
  value,
  currency,
  onChange,
  labelledBy,
}: {
  field: OptionFieldDto;
  value: DraftValue;
  /** Shown as the suffix on a money field, so a figure reads in its own units. */
  currency: string | null;
  onChange: (next: DraftValue) => void;
  labelledBy: string;
}) {
  const text = Array.isArray(value) ? '' : value;

  if (field.dataType === 'MULTI') {
    const ticked = new Set(Array.isArray(value) ? value : []);
    const choices = field.choices ?? [];
    if (choices.length === 0) {
      return (
        <p className="text-content-subtle text-xs">
          No answers recorded for this setting yet.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1.5" role="group" aria-label={field.label}>
        {choices.map((choice) => (
          <label key={choice.id} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="accent-brand size-4"
              checked={ticked.has(choice.id)}
              onChange={(event) => {
                const next = new Set(ticked);
                if (event.target.checked) next.add(choice.id);
                else next.delete(choice.id);
                onChange([...next]);
              }}
            />
            {choice.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.dataType === 'RANK') {
    return (
      <Select
        aria-labelledby={labelledBy}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not specified</option>
        {(field.choices ?? []).map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.dataType === 'BOOLEAN') {
    return (
      <Select
        aria-labelledby={labelledBy}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not specified</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  }

  if (isNumeric(field)) {
    return (
      <NumberInput
        aria-labelledby={labelledBy}
        suffix={field.unit ?? (field.dataType === 'CURRENCY' ? (currency ?? '') : '')}
        value={text}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      aria-labelledby={labelledBy}
      value={text}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Not specified"
    />
  );
}

/**
 * What the API should be sent for a drafted value, or `undefined` when the
 * field is a MULTI (whose answers go to their own endpoint).
 *
 * An empty box is `null` — the plan did not say — and never a zero. That
 * distinction is the whole reason figures are nullable in the first place.
 */
export function toApiValue(
  field: OptionFieldDto,
  value: DraftValue,
): number | string | boolean | null | undefined {
  if (field.dataType === 'MULTI') return undefined;
  if (Array.isArray(value)) return undefined;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (field.dataType === 'BOOLEAN') return trimmed === 'true';
  if (isNumeric(field)) {
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return trimmed;
}

/** How a stored value reads back into the draft. */
export function toDraftValue(
  field: OptionFieldDto,
  stored: { value?: number | string | boolean | null; selectedChoiceIds?: string[] } | undefined,
): DraftValue {
  if (field.dataType === 'MULTI') return stored?.selectedChoiceIds ?? [];
  const value = stored?.value;
  if (value === null || value === undefined) return '';
  return String(value);
}
