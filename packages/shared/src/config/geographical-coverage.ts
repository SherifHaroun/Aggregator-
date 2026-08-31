/**
 * Where a variant provides cover.
 *
 * A LIST THAT GROWS. It began as Local and International because that is what
 * the legacy data held, but insurers sell wider scopes than that, and a scope
 * nobody anticipated must not mean rewriting the application. Adding one is:
 * an entry here, a value on the Prisma enum, and a migration —
 * `apps/api/src/lib/enum-parity.ts` makes doing fewer than all three a build
 * failure.
 *
 * It stays an enum rather than a table because it is APPLICATION
 * CONFIGURATION, not insurance data: the comparison filters on it, so an
 * employee inventing "Locl" at midnight would quietly stop matching plans.
 * PostgreSQL refusing an unknown value outright is worth the migration.
 *
 * `enabled: false` retires a scope from the pickers without invalidating the
 * variants already recorded against it.
 */

import type { ConfigOption, OptionRegistry } from './option-registry.js';

export const GEOGRAPHICAL_COVERAGE_IDS = [
  'LOCAL',
  'INTERNATIONAL',
  'LOCAL_AND_INTERNATIONAL',
  'WORLDWIDE',
  'OTHER',
] as const;

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
  LOCAL_AND_INTERNATIONAL: {
    id: 'LOCAL_AND_INTERNATIONAL',
    label: 'Local + International',
    description: 'Cover at home and abroad under one variant.',
    order: 3,
    enabled: true,
  },
  WORLDWIDE: {
    id: 'WORLDWIDE',
    label: 'Worldwide',
    order: 4,
    enabled: true,
  },
  /**
   * A scope the list does not yet name.
   *
   * Present so an unusual plan can be recorded today rather than waiting for a
   * migration — but it says nothing about WHERE, so a comparison can only treat
   * it as "not one of the above". A scope that turns up repeatedly deserves its
   * own entry here.
   */
  OTHER: {
    id: 'OTHER',
    label: 'Other',
    description: 'Anything the list above does not cover.',
    order: 5,
    enabled: true,
  },
};

/**
 * What a variant is called on screen: the plan's name and what it covers.
 *
 * DERIVED, NEVER STORED. A stored copy is a second truth that stops being true
 * the moment the plan is renamed — and renaming a plan is ordinary. The parts
 * are what the database keeps and what the comparison filters on; this is only
 * how they read together.
 */
export function variantDisplayName(
  planName: string,
  coverage: GeographicalCoverageId | null | undefined,
): string {
  const scope = coverage ? GEOGRAPHICAL_COVERAGES[coverage]?.label : null;
  const name = planName.trim();
  return scope ? `${name} ${scope}` : name;
}
