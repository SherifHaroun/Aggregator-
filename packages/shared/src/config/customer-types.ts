/**
 * "Who do you want to insure?" — the first selection of a comparison.
 *
 * The list is exactly: Individual, Family, SME.
 * To add, rename, reorder or retire a customer type, edit this file only.
 */

import { SME_FIXED_AVERAGE_AGE } from './business-rules.js';
import type { ConfigOption, OptionRegistry } from './option-registry.js';

export const CUSTOMER_TYPE_IDS = ['INDIVIDUAL', 'FAMILY', 'SME'] as const;

export type CustomerTypeId = (typeof CUSTOMER_TYPE_IDS)[number];

/**
 * How the age information for a customer type is obtained.
 *
 *  - `SINGLE_AGE`    one age, typed by the employee — the person insured.
 *  - `AGE_RANGE`     the youngest and oldest to be covered. A plan matches only
 *                    if its own band spans the whole range, so nobody in the
 *                    group is left outside the cover.
 *  - `FIXED_AVERAGE` the age is a fixed business constant, shown but never
 *                    entered.
 */
export type AgeInputMode = 'SINGLE_AGE' | 'AGE_RANGE' | 'FIXED_AVERAGE';

export interface CustomerTypeOption extends ConfigOption<CustomerTypeId> {
  ageInputMode: AgeInputMode;
  /**
   * The fixed average age, when `ageInputMode === 'FIXED_AVERAGE'`.
   * Always references a constant from `business-rules.ts` — never a literal.
   */
  fixedAverageAge: number | null;
}

export const CUSTOMER_TYPES: OptionRegistry<CustomerTypeId, CustomerTypeOption> = {
  INDIVIDUAL: {
    id: 'INDIVIDUAL',
    label: 'Individual',
    description: 'Cover for a single person.',
    order: 1,
    enabled: true,
    ageInputMode: 'SINGLE_AGE',
    fixedAverageAge: null,
  },
  FAMILY: {
    id: 'FAMILY',
    label: 'Family',
    description: 'Cover for a family group.',
    order: 2,
    enabled: true,
    ageInputMode: 'AGE_RANGE',
    fixedAverageAge: null,
  },
  SME: {
    id: 'SME',
    label: 'SME',
    description: 'Cover for a small or medium-sized business.',
    order: 3,
    enabled: true,
    ageInputMode: 'FIXED_AVERAGE',
    fixedAverageAge: SME_FIXED_AVERAGE_AGE,
  },
};
