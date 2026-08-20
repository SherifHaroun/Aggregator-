/**
 * Age business rules.
 *
 * THE ONLY PLACE in the codebase that decides which age applies to a customer
 * type. Never re-implement "if SME then 35" anywhere else — call
 * `resolveAverageAgeForCustomerType()` instead.
 */

import { AVERAGE_AGE_LABEL_PREFIX } from '../config/business-rules.js';
import { CUSTOMER_TYPES, type CustomerTypeId } from '../config/customer-types.js';
import type { ResolvedAverageAge } from '../types/comparison.js';

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
