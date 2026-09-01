/**
 * HOW GOOD A PLAN IS, READ OFF WHAT IT ACTUALLY PAYS.
 *
 * Basic, Standard and Premium are not a category somebody files a plan under.
 * They are a reading of its annual limit, and the limit is already recorded —
 * so the tier is DERIVED and never stored. Nothing to choose, nothing to keep
 * in sync, and a plan whose ceiling is raised becomes Premium the moment it is
 * saved rather than whenever somebody remembers to refile it.
 *
 * This replaces the old `InsuranceType` table (Base, Middle, High, Standard,
 * Medical), which was a stored category an employee picked by hand. It could
 * disagree with the plan's own figures and, being free text, said nothing a
 * comparison could act on.
 *
 * THE LIMIT IS THE VARIANT'S, so the tier is the VARIANT's. One plan sold at
 * 30,000 locally and 150,000 internationally is genuinely Basic one way and
 * Premium the other; a single tier on the plan would have to be wrong about one
 * of them.
 */

import type { ConfigOption, OptionRegistry } from './option-registry.js';

export const PLAN_TIER_IDS = ['BASIC', 'STANDARD', 'PREMIUM'] as const;

export type PlanTierId = (typeof PLAN_TIER_IDS)[number];

export interface PlanTierOption extends ConfigOption<PlanTierId> {
  /** Inclusive floor. `null` on the lowest tier, which has none. */
  minAnnualLimit: number | null;
  /** Inclusive ceiling. `null` on the highest tier, which has none. */
  maxAnnualLimit: number | null;
}

/**
 * The two thresholds, in one place.
 *
 * They come from the legacy pricing data, where the products clustered either
 * side of 50,000 and 100,000. Moving a boundary is a one-line change here and
 * every screen, filter and comparison follows.
 */
export const TIER_LOWER_THRESHOLD = 50_000;
export const TIER_UPPER_THRESHOLD = 100_000;

export const PLAN_TIERS: OptionRegistry<PlanTierId, PlanTierOption> = {
  BASIC: {
    id: 'BASIC',
    label: 'Basic',
    description: `Annual limit below ${TIER_LOWER_THRESHOLD.toLocaleString('en-US')}.`,
    order: 1,
    enabled: true,
    minAnnualLimit: null,
    maxAnnualLimit: TIER_LOWER_THRESHOLD - 1,
  },
  STANDARD: {
    id: 'STANDARD',
    label: 'Standard',
    description: `Annual limit from ${TIER_LOWER_THRESHOLD.toLocaleString('en-US')} to ${TIER_UPPER_THRESHOLD.toLocaleString('en-US')}.`,
    order: 2,
    enabled: true,
    minAnnualLimit: TIER_LOWER_THRESHOLD,
    maxAnnualLimit: TIER_UPPER_THRESHOLD,
  },
  PREMIUM: {
    id: 'PREMIUM',
    label: 'Premium',
    description: `Annual limit above ${TIER_UPPER_THRESHOLD.toLocaleString('en-US')}.`,
    order: 3,
    enabled: true,
    minAnnualLimit: TIER_UPPER_THRESHOLD + 1,
    maxAnnualLimit: null,
  },
};

/**
 * The tier an annual limit falls in, or `null` when the plan never stated one.
 *
 * A plan with no ceiling recorded is not Basic — it is a plan whose ceiling
 * nobody wrote down, and calling that the cheapest tier would be inventing a
 * figure the document does not contain.
 *
 * Both thresholds are INCLUSIVE of the tier above them, which is what makes
 * 50,000 Standard and 100,000 Standard rather than either boundary landing in
 * two tiers at once.
 */
export function planTier(annualLimit: number | null | undefined): PlanTierId | null {
  if (annualLimit === null || annualLimit === undefined) return null;
  if (!Number.isFinite(annualLimit)) return null;
  if (annualLimit < TIER_LOWER_THRESHOLD) return 'BASIC';
  if (annualLimit <= TIER_UPPER_THRESHOLD) return 'STANDARD';
  return 'PREMIUM';
}

/** The tier's label, or what to show when the plan stated no ceiling. */
export function planTierLabel(annualLimit: number | null | undefined): string | null {
  const tier = planTier(annualLimit);
  return tier ? PLAN_TIERS[tier].label : null;
}

/**
 * The limits a tier covers, as a range a database query can filter on.
 *
 * This is how the comparison narrows to a tier without storing one: it asks
 * for the ceilings that read as Basic rather than for a column called tier.
 */
export function tierLimitRange(tier: PlanTierId): { gte?: number; lte?: number } {
  const { minAnnualLimit, maxAnnualLimit } = PLAN_TIERS[tier];
  return {
    ...(minAnnualLimit === null ? {} : { gte: minAnnualLimit }),
    ...(maxAnnualLimit === null ? {} : { lte: maxAnnualLimit }),
  };
}
