/**
 * Declarative definition of the comparison selection screen.
 *
 * The UI renders whatever this file describes; it does not hardcode headings,
 * ordering or which selections exist. Adding a future selection step is a
 * matter of adding an entry here plus its option registry.
 */

import type { ComparisonCriteriaInput } from '../types/comparison.js';

export const COMPARISON_STEP_IDS = ['CUSTOMER_TYPE', 'GEOGRAPHICAL_COVERAGE'] as const;

export type ComparisonStepId = (typeof COMPARISON_STEP_IDS)[number];

/** Which option registry supplies the choices for a step. */
export type ComparisonOptionSource = 'CUSTOMER_TYPES' | 'GEOGRAPHICAL_COVERAGES';

export interface ComparisonStepDefinition {
  id: ComparisonStepId;
  /** The field of `ComparisonCriteriaInput` this step writes to. */
  field: keyof ComparisonCriteriaInput;
  /** Registry the UI should read the selectable options from. */
  optionSource: ComparisonOptionSource;
  title: string;
  description?: string;
  order: number;
  enabled: boolean;
  required: boolean;
  /** Message shown when a required step has not been answered. */
  requiredMessage: string;
}

export const COMPARISON_STEPS: readonly ComparisonStepDefinition[] = [
  {
    id: 'CUSTOMER_TYPE',
    field: 'customerTypeId',
    optionSource: 'CUSTOMER_TYPES',
    title: 'Who do you want to insure?',
    order: 1,
    enabled: true,
    required: true,
    requiredMessage: 'Select who you want to insure.',
  },
  {
    id: 'GEOGRAPHICAL_COVERAGE',
    field: 'geographicalCoverageId',
    optionSource: 'GEOGRAPHICAL_COVERAGES',
    title: 'Geographical coverage',
    order: 2,
    enabled: true,
    required: true,
    requiredMessage: 'Select a geographical coverage.',
  },
];

/** Enabled steps in display order. */
export function listComparisonSteps(): ComparisonStepDefinition[] {
  return COMPARISON_STEPS.filter((step) => step.enabled).sort((a, b) => a.order - b.order);
}
