/**
 * ============================================================================
 *  CENTRAL BUSINESS RULES
 * ============================================================================
 *
 * Single source of truth for business constants that the company may change.
 * This file intentionally contains **only plain values and no imports**, so it
 * can be referenced from anywhere (config, rules, API, UI) without creating
 * circular dependencies.
 *
 * RULE FOR THE WHOLE CODEBASE:
 *   Never write a business number or business string literal inside a React
 *   component, a route handler, or a service. Declare it here and import it.
 *
 * Derived logic that *uses* these constants lives in `src/rules/`.
 */

/**
 * Fixed average age used for every SME comparison.
 *
 * Business rule: SME insurance results are always quoted against a standard
 * average age. The employee never enters this value manually.
 *
 * Change this single constant if the company revises the standard.
 */
export const SME_FIXED_AVERAGE_AGE = 35;

/**
 * Wording used whenever a resolved average age is displayed or printed
 * (comparison screens, results, exports). Keep the phrasing here so it can be
 * changed in one place.
 */
export const AVERAGE_AGE_LABEL_PREFIX = 'Average age';

/**
 * Explanation shown to the employee next to an SME selection, so it is obvious
 * why no age input is offered.
 */
export const SME_FIXED_AVERAGE_AGE_NOTICE =
  'SME comparisons are always generated using the standard average age.';
