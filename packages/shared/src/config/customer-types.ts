/**
 * "Who do you want to insure?" — the first selection of a comparison.
 *
 * The list is exactly: Individual, Family, SME.
 * To add, rename, reorder or retire a customer type, edit this file only.
 *
 * ONLY SME IS ON SALE FOR NOW. Individual and Family are `enabled: false`:
 * they stay in the codebase, their plans stay in the database and remain
 * valid for every record that names them, but neither the customer site nor
 * the employee's comparison offers them — the site says "coming soon"
 * instead. Turning one back on is this one flag.
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
    enabled: false,
    ageInputMode: 'SINGLE_AGE',
    fixedAverageAge: null,
  },
  FAMILY: {
    id: 'FAMILY',
    label: 'Family',
    description: 'Cover for a family group.',
    order: 2,
    enabled: false,
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

/** The customer types on sale, in display order. */
export const ENABLED_CUSTOMER_TYPE_IDS: readonly CustomerTypeId[] = CUSTOMER_TYPE_IDS.filter(
  (id) => CUSTOMER_TYPES[id].enabled,
);

/** The first customer type on sale — what a form opens on. */
export const DEFAULT_CUSTOMER_TYPE_ID: CustomerTypeId = ENABLED_CUSTOMER_TYPE_IDS[0] ?? 'SME';
