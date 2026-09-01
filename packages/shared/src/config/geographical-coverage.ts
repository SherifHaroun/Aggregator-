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
 * `enabled: false` RETIRES a scope. It disappears from every picker and the
 * API stops accepting it, while the variants already recorded against it stay
 * readable and keep their label — retiring a scope is not the same as deciding
 * it never existed, and a plan sold that way is still a plan that was sold.
 *
 * Currently the business sells two: Local and International. The wider scopes
 * are kept, retired, because the enum value is what makes an old row readable
 * and dropping one is a migration that fails the moment a row uses it.
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
  /**
   * RETIRED. The business quotes Local or International and nothing between —
   * a plan covering both is sold as two variants, which is what the rest of
   * the model already assumes when it prices and compares them separately.
   */
  LOCAL_AND_INTERNATIONAL: {
    id: 'LOCAL_AND_INTERNATIONAL',
    label: 'Local + International',
    description: 'Cover at home and abroad under one variant.',
    order: 3,
    enabled: false,
  },
  /** RETIRED. International is the scope the documents actually state. */
  WORLDWIDE: {
    id: 'WORLDWIDE',
    label: 'Worldwide',
    order: 4,
    enabled: false,
  },
  /**
   * RETIRED. It said nothing about WHERE, so a comparison could only ever read
   * it as "not one of the above" — a variant nobody could be matched against
   * on the one question the field exists to answer.
   */
  OTHER: {
    id: 'OTHER',
    label: 'Other',
    description: 'Anything the list above does not cover.',
    order: 5,
    enabled: false,
  },
};

/**
 * The scopes a variant may be SAVED as, and a comparison may ask for.
 *
 * Derived from the registry rather than listed again, so retiring a scope stops
 * it being written by every route at once — including a request typed by hand
 * against the API, which no picker can prevent. Reading an old variant recorded
 * under a retired scope is unaffected: the enum still holds it.
 */
export const ENABLED_GEOGRAPHICAL_COVERAGE_IDS = GEOGRAPHICAL_COVERAGE_IDS.filter(
  (id) => GEOGRAPHICAL_COVERAGES[id].enabled,
) as unknown as readonly [GeographicalCoverageId, ...GeographicalCoverageId[]];

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
