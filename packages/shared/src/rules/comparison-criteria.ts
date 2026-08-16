/**
 * Validation and resolution of the comparison selections.
 *
 * Shared by the web client (instant feedback) and the API (authoritative
 * check), so both always agree.
 */

import { listComparisonSteps } from '../config/comparison-form.js';
import { CUSTOMER_TYPES } from '../config/customer-types.js';
import { GEOGRAPHICAL_COVERAGES } from '../config/geographical-coverage.js';
import { isOptionId, optionLabel } from '../config/option-registry.js';
import type {
  CompleteComparisonCriteria,
  ComparisonCriteriaInput,
  ComparisonValidationResult,
  ResolvedComparisonCriteria,
} from '../types/comparison.js';
import { resolveAverageAgeForCustomerType } from './age.js';

/** An empty selection state — the initial value of the comparison screen. */
export function createEmptyComparisonCriteria(): ComparisonCriteriaInput {
  return {
    customerTypeId: null,
    geographicalCoverageId: null,
  };
}

/** Check every enabled, required step has a valid selection. */
export function validateComparisonCriteria(
  input: Partial<ComparisonCriteriaInput>,
): ComparisonValidationResult {
  const issues: ComparisonValidationResult['issues'] = [];

  for (const step of listComparisonSteps()) {
    const value = input[step.field] ?? null;

    if (step.required && value === null) {
      issues.push({ field: step.field, message: step.requiredMessage });
      continue;
    }
    if (value === null) continue;

    const known =
      step.optionSource === 'CUSTOMER_TYPES'
        ? isOptionId(CUSTOMER_TYPES, value)
        : isOptionId(GEOGRAPHICAL_COVERAGES, value);

    if (!known) {
      issues.push({ field: step.field, message: `Unknown selection: ${String(value)}` });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Narrowing helper: are all selections present and valid? */
export function isCompleteComparisonCriteria(
  input: Partial<ComparisonCriteriaInput>,
): input is CompleteComparisonCriteria {
  return validateComparisonCriteria(input).valid;
}

/**
 * Apply the business rules to a complete set of selections.
 *
 * The result carries the labels and the resolved average age, so every screen
 * and export renders the same wording without repeating any rule.
 */
export function resolveComparisonCriteria(
  input: CompleteComparisonCriteria,
): ResolvedComparisonCriteria {
  return {
    customerTypeId: input.customerTypeId,
    customerTypeLabel: optionLabel(CUSTOMER_TYPES, input.customerTypeId),
    geographicalCoverageId: input.geographicalCoverageId,
    geographicalCoverageLabel: optionLabel(GEOGRAPHICAL_COVERAGES, input.geographicalCoverageId),
    averageAge: resolveAverageAgeForCustomerType(input.customerTypeId),
  };
}
