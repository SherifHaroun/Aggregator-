/**
 * Maps a step's `optionSource` to the option list the UI should render.
 *
 * This is the ONLY place the client resolves a registry. Adding a future
 * selection step means adding its registry here and to the shared config —
 * nothing in the components changes.
 */

import {
  CUSTOMER_TYPES,
  GEOGRAPHICAL_COVERAGES,
  listEnabledOptions,
  type ComparisonOptionSource,
  type ConfigOption,
} from '@aggregator/shared';

export function getOptionsForSource(source: ComparisonOptionSource): ConfigOption[] {
  switch (source) {
    case 'CUSTOMER_TYPES':
      return listEnabledOptions(CUSTOMER_TYPES);
    case 'GEOGRAPHICAL_COVERAGES':
      return listEnabledOptions(GEOGRAPHICAL_COVERAGES);
    default: {
      const exhaustive: never = source;
      throw new Error(`Unhandled option source: ${String(exhaustive)}`);
    }
  }
}
