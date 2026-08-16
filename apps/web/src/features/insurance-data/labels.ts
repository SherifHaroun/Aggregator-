/**
 * Display helpers for insurance data.
 *
 * Customer-type and coverage labels come from the centralized business
 * configuration, so wording changes in one place. Nothing here names a
 * benefit — those are database records.
 */

import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  optionLabel,
  type CustomerTypeId,
  type GeographicalCoverageId,
} from '@aggregator/shared';

export const customerTypeLabel = (id: CustomerTypeId) => optionLabel(CUSTOMER_TYPES, id);
export const coverageLabel = (id: GeographicalCoverageId) => optionLabel(GEOGRAPHICAL_COVERAGES, id);

/** "Individual • Local" — the identity of a configuration. */
export function configurationLabel(
  customerType: CustomerTypeId,
  geographicalCoverage: GeographicalCoverageId,
): string {
  return `${customerTypeLabel(customerType)} • ${coverageLabel(geographicalCoverage)}`;
}

/** Format an amount with its plan currency, falling back to a plain number. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return '—';
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}

/** "8 benefits" / "1 benefit" / "No benefits yet". */
export function benefitCountLabel(count: number): string {
  if (count === 0) return 'No benefits yet';
  return `${count} ${count === 1 ? 'benefit' : 'benefits'}`;
}
