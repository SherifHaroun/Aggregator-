/**
 * Contracts for the insurance comparison request.
 *
 * These describe what the employee *selects*. They deliberately say nothing
 * about insurance companies, plans, benefits or prices — that data lives in the
 * database and its shape will be defined in a later step.
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import type { GeographicalCoverageId } from '../config/geographical-coverage.js';

/**
 * The raw selections made on the comparison screen.
 *
 * Additional criteria (age details, budget, insurance type, ...) will be added
 * here as they are specified. Keep every field optional-until-selected so the
 * screen can be filled in any order.
 */
export interface ComparisonCriteriaInput {
  customerTypeId: CustomerTypeId | null;
  geographicalCoverageId: GeographicalCoverageId | null;
}

/** A comparison request with every selection made. */
export type CompleteComparisonCriteria = {
  [K in keyof ComparisonCriteriaInput]: NonNullable<ComparisonCriteriaInput[K]>;
};

/** Where a resolved average age came from. */
export type AverageAgeSource =
  /** Fixed business constant (currently: SME). */
  | 'FIXED_BUSINESS_RULE'
  /** Supplied by the employee. Not implemented yet. */
  | 'EMPLOYEE_INPUT'
  /** No age information available for this selection yet. */
  | 'NOT_SPECIFIED';

/** The age information that applies to a comparison. */
export interface ResolvedAverageAge {
  value: number | null;
  source: AverageAgeSource;
  /** Ready-to-display wording, e.g. "Average age: 35". `null` when unknown. */
  label: string | null;
}

/**
 * The selections after every business rule has been applied. This — not the raw
 * input — is what the comparison engine and the results screen consume.
 */
export interface ResolvedComparisonCriteria {
  customerTypeId: CustomerTypeId;
  customerTypeLabel: string;
  geographicalCoverageId: GeographicalCoverageId;
  geographicalCoverageLabel: string;
  averageAge: ResolvedAverageAge;
}

/** A single failed validation on the comparison screen. */
export interface ComparisonValidationIssue {
  field: keyof ComparisonCriteriaInput;
  message: string;
}

export interface ComparisonValidationResult {
  valid: boolean;
  issues: ComparisonValidationIssue[];
}
