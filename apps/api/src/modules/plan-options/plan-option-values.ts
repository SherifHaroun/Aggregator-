/**
 * Translation between the API's single `value` and the typed columns of
 * `PlanOptionValue`.
 *
 * This is the ONLY place that decides which column a value lives in and what
 * counts as a valid value for a data type. Both writing and reading go through
 * it, so a field defined by an employee is validated without any code knowing
 * what the field means.
 */

import { PERCENTAGE_MAX, PERCENTAGE_MIN, storageForDataType } from '@aggregator/shared';
import type { OptionField } from '@prisma/client';
import { toNumber, type DecimalLike } from '../../lib/decimal.js';
import { badRequest } from '../../lib/errors.js';

export interface ValueColumns {
  numberValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
}

const EMPTY: ValueColumns = { numberValue: null, textValue: null, booleanValue: null };

/**
 * Validate a value against its field definition and place it in the right
 * column. `null` clears the value.
 */
export function buildValueColumns(field: OptionField, value: unknown): ValueColumns {
  if (value === null || value === undefined) {
    if (field.isRequired) {
      throw badRequest(`"${field.label}" is required.`, { [field.key]: ['This value is required.'] });
    }
    return EMPTY;
  }

  switch (storageForDataType(field.dataType)) {
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw badRequest(`"${field.label}" must be a number.`, {
          [field.key]: ['Expected a number.'],
        });
      }
      if (field.dataType === 'PERCENTAGE' && (value < PERCENTAGE_MIN || value > PERCENTAGE_MAX)) {
        throw badRequest(
          `"${field.label}" must be between ${PERCENTAGE_MIN} and ${PERCENTAGE_MAX}.`,
          { [field.key]: [`Expected a percentage between ${PERCENTAGE_MIN} and ${PERCENTAGE_MAX}.`] },
        );
      }
      if (field.dataType === 'CURRENCY' && value < 0) {
        throw badRequest(`"${field.label}" cannot be negative.`, {
          [field.key]: ['Expected a positive amount.'],
        });
      }
      return { ...EMPTY, numberValue: value };
    }

    case 'TEXT': {
      if (typeof value !== 'string') {
        throw badRequest(`"${field.label}" must be text.`, { [field.key]: ['Expected text.'] });
      }
      const trimmed = value.trim();
      if (trimmed === '') return EMPTY;
      return { ...EMPTY, textValue: trimmed };
    }

    case 'BOOLEAN': {
      if (typeof value !== 'boolean') {
        throw badRequest(`"${field.label}" must be yes or no.`, {
          [field.key]: ['Expected true or false.'],
        });
      }
      return { ...EMPTY, booleanValue: value };
    }

    default:
      throw badRequest(`Unsupported data type for "${field.label}".`);
  }
}

/**
 * The three typed columns, as read from the database (`Decimal`) or as just
 * produced by `buildValueColumns` (`number`). Accepting both makes the
 * write-then-read round trip type-safe.
 */
export interface StoredValueColumns {
  numberValue: DecimalLike | null;
  textValue: string | null;
  booleanValue: boolean | null;
}

/** Read the stored value back out of whichever column holds it. */
export function readValue(
  field: Pick<OptionField, 'dataType'>,
  row: StoredValueColumns | undefined,
): number | string | boolean | null {
  if (!row) return null;
  switch (storageForDataType(field.dataType)) {
    case 'NUMBER':
      return toNumber(row.numberValue);
    case 'TEXT':
      return row.textValue;
    case 'BOOLEAN':
      return row.booleanValue;
    default:
      return null;
  }
}
