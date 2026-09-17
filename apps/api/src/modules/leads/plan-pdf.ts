/**
 * THE PLAN PDF, BUILT ON THE SERVER.
 *
 * The same document the browser builds when somebody presses "Download PDF":
 * the same renderer from `@aggregator/shared`, fed the same three things —
 * the plan as the comparison priced it for THIS visitor, the variant's
 * benefits beyond the six, and the plan's description. Nothing is written
 * for the email alone, so the attachment can never disagree with the page.
 */

import {
  medicalNetworkProviderListPath,
  presentPremium,
  readPlanDocument,
  renderPlanDocument,
  type ComparisonPlanResult,
  type PlanDocumentFile,
} from '@aggregator/shared';
import { env } from '../../config/env.js';
import { runComparison } from '../comparison/comparison.service.js';
import type { ComparisonRequestPayload } from '../comparison/comparison.schemas.js';
import { getPlanConfiguration } from '../plan-configurations/plan-configurations.service.js';
import { getPlan } from '../plans/plans.service.js';

export interface PricedPlanDocument {
  /** The plan, priced for the visitor. */
  plan: ComparisonPlanResult;
  /** "EGP 12,000" — as the screen shows it. */
  premium: string;
  file: PlanDocumentFile;
}

/**
 * Run the visitor's comparison again and pick the plan out of it — the
 * premium on the document is the engine's answer for their workforce, never
 * a figure a screen sent in — then draw it. `null` when the plan is not in
 * the result: withdrawn since the results were drawn, or never in them.
 */
export async function buildPricedPlanDocument(
  criteria: ComparisonRequestPayload,
  configurationId: string,
  customerName: string,
): Promise<PricedPlanDocument | null> {
  const result = await runComparison(criteria);
  const plan = [...result.plans, ...result.overBudgetPlans].find(
    (candidate) => candidate.configurationId === configurationId,
  );
  if (!plan) return null;

  const [variant, product] = await Promise.all([
    getPlanConfiguration(plan.configurationId),
    getPlan(plan.planId),
  ]);

  const file = renderPlanDocument({
    plan,
    ...readPlanDocument(variant),
    description: product.description?.trim() || null,
    ages: {
      ageFrom: result.criteria.ageFrom,
      ageTo: result.criteria.ageTo,
      assumed: result.criteria.ageAssumed,
    },
    customerName,
    providerListUrl: (networkId) =>
      `${env.publicApiUrl}${medicalNetworkProviderListPath(networkId)}`,
  });

  return { plan, premium: presentPremium(plan), file };
}
