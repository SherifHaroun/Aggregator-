/**
 * Geographical coverage selection.
 *
 * The list is exactly: Local, International.
 * To change the wording or add a further coverage scope, edit this file only.
 */

import type { ConfigOption, OptionRegistry } from './option-registry.js';

export const GEOGRAPHICAL_COVERAGE_IDS = ['LOCAL', 'INTERNATIONAL'] as const;

export type GeographicalCoverageId = (typeof GEOGRAPHICAL_COVERAGE_IDS)[number];

export type GeographicalCoverageOption = ConfigOption<GeographicalCoverageId>;

export const GEOGRAPHICAL_COVERAGES: OptionRegistry<
  GeographicalCoverageId,
  GeographicalCoverageOption
> = {
  LOCAL: {
    id: 'LOCAL',
    label: 'Local',
    order: 1,
    enabled: true,
  },
  INTERNATIONAL: {
    id: 'INTERNATIONAL',
    label: 'International',
    order: 2,
    enabled: true,
  },
};
