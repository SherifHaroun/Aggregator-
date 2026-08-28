/**
 * The data types an option field can have.
 *
 * This is SYSTEM CONFIGURATION, not insurance data: it is the fixed vocabulary
 * the application understands, mirrored by the `OptionFieldDataType` enum in
 * the Prisma schema. Employees create *fields* (Coverage Percentage, Annual
 * Limit, Maximum Sessions, ...) as database records; they pick one of these
 * types for each field.
 *
 * Adding a type here requires a matching Prisma enum value and a migration —
 * which is why the list is deliberately small and generic.
 */

import type { ComparisonDirection } from './comparison-scoring.js';
import type { ConfigOption, OptionRegistry } from './option-registry.js';

export const OPTION_FIELD_DATA_TYPES_IDS = [
  'NUMBER',
  'PERCENTAGE',
  'CURRENCY',
  'TEXT',
  'BOOLEAN',
  'RANK',
] as const;

export type OptionFieldDataType = (typeof OPTION_FIELD_DATA_TYPES_IDS)[number];

/** Which typed column of `PlanOptionValue` stores a value of this type. */
export type OptionValueStorage = 'NUMBER' | 'TEXT' | 'BOOLEAN';

export interface OptionFieldDataTypeOption extends ConfigOption<OptionFieldDataType> {
  storage: OptionValueStorage;
  /** Suggested unit shown in the field editor. Employees may override it. */
  defaultUnit: string | null;
  /**
   * Which way is better when the comparison ranks this kind of value.
   *
   * Declared per DATA TYPE, never per benefit name, so a benefit invented
   * tomorrow is ranked correctly without a code change.
   */
  comparison: ComparisonDirection;
}

export const OPTION_FIELD_DATA_TYPES: OptionRegistry<
  OptionFieldDataType,
  OptionFieldDataTypeOption
> = {
  NUMBER: {
    id: 'NUMBER',
    label: 'Number',
    description: 'A plain number, e.g. a number of visits, sessions or months.',
    order: 1,
    enabled: true,
    storage: 'NUMBER',
    defaultUnit: null,
    /** A count, e.g. sessions or visits: more of it is better cover. */
    comparison: 'HIGHER_IS_BETTER',
  },
  PERCENTAGE: {
    id: 'PERCENTAGE',
    label: 'Percentage',
    description: 'A percentage between 0 and 100, e.g. a coverage percentage.',
    order: 2,
    enabled: true,
    storage: 'NUMBER',
    defaultUnit: '%',
    /** Coverage percentage: 90% covers more than 60%. */
    comparison: 'HIGHER_IS_BETTER',
  },
  CURRENCY: {
    id: 'CURRENCY',
    label: 'Amount',
    description: 'A monetary amount, e.g. an annual limit. Uses the plan currency.',
    order: 3,
    enabled: true,
    storage: 'NUMBER',
    defaultUnit: null,
    /** A benefit amount, e.g. a limit: a bigger one pays out more. */
    comparison: 'HIGHER_IS_BETTER',
  },
  TEXT: {
    id: 'TEXT',
    label: 'Text',
    description: 'Free text, for information that is not numeric.',
    order: 4,
    enabled: true,
    storage: 'TEXT',
    defaultUnit: null,
    /** Free text cannot be ranked; it is shown but never scored. */
    comparison: 'NOT_COMPARABLE',
  },
  BOOLEAN: {
    id: 'BOOLEAN',
    label: 'Yes / No',
    description: 'A yes-or-no answer, e.g. whether pre-approval is required.',
    order: 5,
    enabled: true,
    storage: 'BOOLEAN',
    defaultUnit: null,
    /** Included beats not included. */
    comparison: 'HIGHER_IS_BETTER',
  },
  RANK: {
    id: 'RANK',
    label: 'Rank',
    description: 'One of a list the employee puts in order, best first.',
    order: 6,
    enabled: true,
    /**
     * The CHOSEN ENTRY'S ID, not its position.
     *
     * Storing the position would silently rewrite history: reordering the list
     * so one network moves above another would change what every plan is
     * recorded as offering. Storing which entry was picked means reordering
     * changes only how good that entry is judged to be — which is the whole
     * point of being able to reorder it.
     */
    storage: 'TEXT',
    defaultUnit: null,
    /** Higher up the employee's list is better cover. */
    comparison: 'HIGHER_IS_BETTER',
  },
};

/** Percentage fields are constrained to this range. */
export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;

/** Which typed column stores a value of the given data type. */
export function storageForDataType(dataType: OptionFieldDataType): OptionValueStorage {
  return OPTION_FIELD_DATA_TYPES[dataType].storage;
}
