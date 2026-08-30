/**
 * Presentation-neutral labels and formatting for insurance data.
 *
 * Lives here rather than in a UI app because a future public aggregator has to
 * render the same customer types, coverage areas and prices as the admin tool,
 * and both must agree. Nothing here names a benefit — those are database
 * records.
 */

import {
  BENEFIT_VALUE_FIELD,
  BENEFIT_VALUE_KINDS,
  benefitKindForDataType,
} from '../config/benefits.js';
import { NOT_SPECIFIED_LABEL } from '../config/business-rules.js';
import { CUSTOMER_TYPES, type CustomerTypeId } from '../config/customer-types.js';
import {
  GEOGRAPHICAL_COVERAGES,
  type GeographicalCoverageId,
} from '../config/geographical-coverage.js';
import { OPTION_FIELD_DATA_TYPES, type OptionFieldDataType } from '../config/option-field-types.js';
import { optionLabel } from '../config/option-registry.js';
import { formatNumberValue } from './number-format.js';

export const customerTypeLabel = (id: CustomerTypeId): string => optionLabel(CUSTOMER_TYPES, id);

export const coverageLabel = (id: GeographicalCoverageId): string =>
  optionLabel(GEOGRAPHICAL_COVERAGES, id);

/**
 * "Percentage", "Limit", "Text" — the kind of value a benefit carries, shown
 * wherever a benefit is listed.
 *
 * Read from the benefit's own definition rather than assumed, so a benefit
 * created before the kind was offered still describes itself honestly. A
 * benefit with no fields at all is an umbrella: it groups others and holds
 * nothing itself.
 */
export function benefitTypeLabel(
  fields?: readonly { dataType: OptionFieldDataType; isOptional?: boolean }[],
): string {
  if (fields && fields.length === 0) return UMBRELLA_BENEFIT_LABEL;

  /**
   * A benefit whose every setting is optional carries no figure of its own:
   * its NAME is the whole benefit. "Covers Hepatitis" is a complete statement,
   * and calling it a percentage because the first thing it may optionally
   * record is one would describe it by something it need never hold.
   */
  if (fields && fields.length > 0 && fields.every((field) => field.isOptional)) {
    return STATEMENT_BENEFIT_LABEL;
  }

  const core = fields?.find((field) => !field.isOptional) ?? fields?.[0];
  const dataType = core?.dataType ?? BENEFIT_VALUE_FIELD.dataType;
  const kind = benefitKindForDataType(dataType);
  return kind ? BENEFIT_VALUE_KINDS[kind].label : optionLabel(OPTION_FIELD_DATA_TYPES, dataType);
}

/** A benefit the document states in words, with no figure attached. */
export const STATEMENT_BENEFIT_LABEL = 'Statement of cover';

/** How a benefit that only groups other benefits describes itself. */
export const UMBRELLA_BENEFIT_LABEL = 'Group of benefits';

/** "Individual • Local" — the identity of a plan configuration. */
export function configurationLabel(
  customerType: CustomerTypeId,
  geographicalCoverage: GeographicalCoverageId,
): string {
  return `${customerTypeLabel(customerType)} • ${coverageLabel(geographicalCoverage)}`;
}

/**
 * Format an amount with its currency, grouped in thousands.
 *
 * A missing amount reads as the business's own wording for a figure the plan
 * document never stated — never as a dash, and never as zero.
 */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return NOT_SPECIFIED_LABEL;
  const formatted = formatNumberValue(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}

/** The same for a percentage, e.g. a co-payment. */
export function formatPercentage(value: number | null): string {
  return value === null ? NOT_SPECIFIED_LABEL : `${formatNumberValue(value)}%`;
}
