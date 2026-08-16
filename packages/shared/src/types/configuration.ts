/**
 * Shape of the configuration payload the API serves to the web client.
 *
 * Today it is assembled from the static registries in `src/config`. When some
 * of this configuration later becomes employee-editable and moves into the
 * database, only the API side changes — the client contract stays the same.
 */

import type { ComparisonStepDefinition } from '../config/comparison-form.js';
import type { CustomerTypeId, CustomerTypeOption } from '../config/customer-types.js';
import type {
  GeographicalCoverageId,
  GeographicalCoverageOption,
} from '../config/geographical-coverage.js';

export interface ComparisonConfigurationPayload {
  steps: ComparisonStepDefinition[];
  options: {
    CUSTOMER_TYPES: CustomerTypeOption[];
    GEOGRAPHICAL_COVERAGES: GeographicalCoverageOption[];
  };
  /** Business constants the UI needs in order to explain itself. */
  businessRules: {
    smeFixedAverageAge: number;
    smeFixedAverageAgeNotice: string;
    averageAgeLabelPrefix: string;
  };
}

export type ComparisonOptionId = CustomerTypeId | GeographicalCoverageId;
