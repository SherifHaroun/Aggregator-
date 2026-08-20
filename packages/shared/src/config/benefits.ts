/**
 * The shape every benefit is created with.
 *
 * An employee invents a benefit by typing a name and nothing else. The system
 * gives it exactly one value to carry — a percentage — which is what
 * "Medical: 80%" means on a plan.
 *
 * The generic option-field model underneath is unchanged: a benefit is still an
 * `InsuranceOption` with `OptionField`s, so a benefit that needs a different
 * shape remains representable and older ones keep rendering. This constant is
 * simply the ONE shape the product creates, so nobody is ever asked to
 * configure a field, a data type or a unit.
 */

import type { OptionFieldDataType } from './option-field-types.js';

export interface BenefitValueField {
  label: string;
  /** Stable machine key, unique within the benefit. */
  key: string;
  dataType: OptionFieldDataType;
  unit: string;
}

export const BENEFIT_VALUE_FIELD: Readonly<BenefitValueField> = {
  label: 'Percentage',
  key: 'percentage',
  dataType: 'PERCENTAGE',
  unit: '%',
};
