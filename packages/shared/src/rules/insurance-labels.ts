/**
 * Presentation-neutral labels and formatting for insurance data.
 *
 * Lives here rather than in a UI app because a future public aggregator has to
 * render the same customer types, coverage areas and prices as the admin tool,
 * and both must agree. Nothing here names a benefit — those are database
 * records.
 */

import { BENEFIT_VALUE_FIELD } from '../config/benefits.js';
import { CUSTOMER_TYPES, type CustomerTypeId } from '../config/customer-types.js';
import {
  GEOGRAPHICAL_COVERAGES,
  type GeographicalCoverageId,
} from '../config/geographical-coverage.js';
import { OPTION_FIELD_DATA_TYPES, type OptionFieldDataType } from '../config/option-field-types.js';
import { optionLabel } from '../config/option-registry.js';

export const customerTypeLabel = (id: CustomerTypeId): string => optionLabel(CUSTOMER_TYPES, id);

export const coverageLabel = (id: GeographicalCoverageId): string =>
  optionLabel(GEOGRAPHICAL_COVERAGES, id);

/**
 * "Percentage" — the kind of value a benefit carries, shown wherever a benefit
 * is listed.
 *
 * Read from the benefit's own definition rather than assumed, so a benefit
 * created before the percentage-only workflow still describes itself honestly.
 */
export function benefitTypeLabel(fields?: readonly { dataType: OptionFieldDataType }[]): string {
  return optionLabel(
    OPTION_FIELD_DATA_TYPES,
    fields?.[0]?.dataType ?? BENEFIT_VALUE_FIELD.dataType,
  );
}

/** "Individual • Local" — the identity of a plan configuration. */
export function configurationLabel(
  customerType: CustomerTypeId,
  geographicalCoverage: GeographicalCoverageId,
): string {
  return `${customerTypeLabel(customerType)} • ${coverageLabel(geographicalCoverage)}`;
}

/** Format an amount with its currency, falling back to a plain number. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return '—';
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}
