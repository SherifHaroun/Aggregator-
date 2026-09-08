/**
 * Age business rules.
 *
 * THE ONLY PLACE in the codebase that decides which age applies to a customer
 * type. Never re-implement "if SME then 35" anywhere else — call
 * `resolveAverageAgeForCustomerType()` instead.
 */

import { AVERAGE_AGE_LABEL_PREFIX, DEFAULT_COMPARISON_AGE } from '../config/business-rules.js';
import { CUSTOMER_TYPES, type CustomerTypeId } from '../config/customer-types.js';
import type { ResolvedAverageAge } from '../types/comparison.js';

/** The ages a comparison actually runs at, and whether they were assumed. */
export interface ResolvedComparisonAges {
  ageFrom: number;
  ageTo: number;
  /**
   * `true` when the customer stated no age and the standard one was used in
   * its place. An SME's fixed age is a rule rather than an assumption, so it
   * is never flagged.
   */
  assumed: boolean;
}

/**
 * WHICH AGES A COMPARISON RUNS AT, from whatever the customer said.
 *
 * The only place this is decided, for the API and the screen alike:
 *
 *  - A fixed-average type (SME) is always compared at its fixed age, whatever
 *    was sent. The headcounts price the workforce; this ages it.
 *  - Both ages given: used as they are.
 *  - One age given: the other is the same, so one person is a range of one.
 *  - Neither given: the standard age, and the result says it was assumed.
 */
export function resolveComparisonAges(
  customerTypeId: CustomerTypeId,
  ageFrom: number | null | undefined,
  ageTo: number | null | undefined,
): ResolvedComparisonAges {
  const fixed = resolveAverageAgeForCustomerType(customerTypeId);
  if (fixed.value !== null) return { ageFrom: fixed.value, ageTo: fixed.value, assumed: false };

  const from = ageFrom ?? ageTo ?? null;
  const to = ageTo ?? ageFrom ?? null;
  if (from === null || to === null) {
    return { ageFrom: DEFAULT_COMPARISON_AGE, ageTo: DEFAULT_COMPARISON_AGE, assumed: true };
  }
  return { ageFrom: from, ageTo: to, assumed: false };
}

/** Format a resolved age for display, e.g. `"Average age: 35"`. */
export function formatAverageAgeLabel(age: number): string {
  return `${AVERAGE_AGE_LABEL_PREFIX}: ${age}`;
}

/** Does this customer type use a fixed average age instead of employee input? */
export function usesFixedAverageAge(customerTypeId: CustomerTypeId): boolean {
  return CUSTOMER_TYPES[customerTypeId].ageInputMode === 'FIXED_AVERAGE';
}

/**
 * Does this customer type cover a GROUP, and so need a youngest and an oldest
 * rather than one age? Currently Family.
 */
export function usesAgeRange(customerTypeId: CustomerTypeId): boolean {
  return CUSTOMER_TYPES[customerTypeId].ageInputMode === 'AGE_RANGE';
}

/**
 * Resolve the age information for a customer type.
 *
 * - Fixed-average types (currently SME) return the configured constant and a
 *   ready-to-display label. Every SME output must show this label.
 * - Manual types return `NOT_SPECIFIED` for now; the employee age input has not
 *   been specified yet and will be added here when it is.
 */
export function resolveAverageAgeForCustomerType(
  customerTypeId: CustomerTypeId,
): ResolvedAverageAge {
  const customerType = CUSTOMER_TYPES[customerTypeId];

  if (customerType.ageInputMode === 'FIXED_AVERAGE' && customerType.fixedAverageAge !== null) {
    return {
      value: customerType.fixedAverageAge,
      source: 'FIXED_BUSINESS_RULE',
      label: formatAverageAgeLabel(customerType.fixedAverageAge),
    };
  }

  return {
    value: null,
    source: 'NOT_SPECIFIED',
    label: null,
  };
}
