/**
 * Assembles the configuration payload for the comparison screen.
 *
 * It reads exclusively from `@aggregator/shared` — no values are re-declared
 * here. When a registry becomes database-backed, replace the corresponding
 * lookup in this one function.
 */

import {
  AVERAGE_AGE_LABEL_PREFIX,
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  SME_FIXED_AVERAGE_AGE,
  SME_FIXED_AVERAGE_AGE_NOTICE,
  listComparisonSteps,
  listEnabledOptions,
  type ComparisonConfigurationPayload,
} from '@aggregator/shared';

export function getComparisonConfiguration(): ComparisonConfigurationPayload {
  return {
    steps: listComparisonSteps(),
    options: {
      CUSTOMER_TYPES: listEnabledOptions(CUSTOMER_TYPES),
      GEOGRAPHICAL_COVERAGES: listEnabledOptions(GEOGRAPHICAL_COVERAGES),
    },
    businessRules: {
      smeFixedAverageAge: SME_FIXED_AVERAGE_AGE,
      smeFixedAverageAgeNotice: SME_FIXED_AVERAGE_AGE_NOTICE,
      averageAgeLabelPrefix: AVERAGE_AGE_LABEL_PREFIX,
    },
  };
}
