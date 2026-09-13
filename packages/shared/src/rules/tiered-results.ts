/**
 * THE RESULTS A CUSTOMER SEES: the best few in each tier.
 *
 * An employee reads the whole ranked list. A customer on the public site is
 * shown the top three Basic, the top three Standard and the top three
 * Premium plans — enough to choose from, in the tier they can afford, without
 * a table of thirty rows. The tier is READ OFF THE ANNUAL LIMIT exactly as
 * everywhere else (`planTier`), and the order within a tier is the engine's
 * own ranking, so the first plan in each tier is the best value in it.
 */

import { PLAN_TIERS, PLAN_TIER_IDS, planTier, type PlanTierId } from '../config/plan-tiers.js';
import type { ComparisonPlanResult } from '../types/comparison-results.js';

export interface TieredPlans {
  tier: PlanTierId;
  label: string;
  description: string;
  plans: ComparisonPlanResult[];
}

/** The tier a compared plan falls in, from the annual limit the engine reported. */
export function planResultTier(plan: ComparisonPlanResult): PlanTierId | null {
  const limit = plan.attributes.find((attribute) => attribute.id === 'annualLimit')?.value ?? null;
  return planTier(limit);
}

/**
 * Up to `limit` plans per tier, best value first, in tier order. A plan whose
 * ceiling was never recorded belongs to no tier and is left out: calling it
 * Basic would be inventing a figure its document does not contain.
 */
export function topPlansByTier(plans: readonly ComparisonPlanResult[], limit = 3): TieredPlans[] {
  return PLAN_TIER_IDS.map((tier) => ({
    tier,
    label: PLAN_TIERS[tier].label,
    description: PLAN_TIERS[tier].description ?? '',
    plans: plans.filter((plan) => planResultTier(plan) === tier).slice(0, limit),
  }));
}
