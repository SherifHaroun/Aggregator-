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
 *  - `MANUAL`        the employee supplies the age information.
 *                    The exact input (single age, range, per-member ages, ...)
 *                    is NOT defined yet and will be specified later.
 *  - `FIXED_AVERAGE` the age is a fixed business constant and is never entered
 *                    by the employee.
 */
export type AgeInputMode = 'MANUAL' | 'FIXED_AVERAGE';

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
    ageInputMode: 'MANUAL',
    fixedAverageAge: null,
  },
  FAMILY: {
    id: 'FAMILY',
    label: 'Family',
    description: 'Cover for a family group.',
    order: 2,
    enabled: true,
    ageInputMode: 'MANUAL',
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
