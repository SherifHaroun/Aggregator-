/**
 * THE PLAN PDF, BUILT ON THE SERVER.
 *
 * The same document the browser builds when somebody presses "Download PDF":
 * the same renderer from `@aggregator/shared`, fed the same three things —
 * the plan as the comparison priced it for THIS visitor, the variant's
 * benefits beyond the six, and the plan's description. Nothing is written
 * for the email alone, so the attachment can never disagree with the page.
 *
 * TWO STEPS, ON PURPOSE. Pricing the plan is quick and decides whether the
 * request is even valid; drawing the PDF reads two more records and takes
 * a moment. The lead service prices on the request and draws afterwards,
 * so the visitor is never kept waiting on the drawing.
 */

import {
  medicalNetworkProviderListPath,
  presentPremium,
  readPlanDocument,
  renderPlanDocument,
  type ComparisonPlanResult,
  type ComparisonResultDto,
  type PlanDocumentFile,
} from '@aggregator/shared';
import { env } from '../../config/env.js';
import type { ComparisonRequestPayload } from '../comparison/comparison.schemas.js';
import { runComparison } from '../comparison/comparison.service.js';
import { getPlanConfiguration } from '../plan-configurations/plan-configurations.service.js';
import { getPlan } from '../plans/plans.service.js';

export interface PricedPlan {
  /** The plan, priced for the visitor. */
  plan: ComparisonPlanResult;
  /** The comparison it came out of — the ages the document names. */
  result: ComparisonResultDto;
  /** "EGP 12,000" — as the screen shows it. */
  premium: string;
}

/**
 * Run the visitor's comparison again and pick the plan out of it — the
 * premium on the document is the engine's answer for their workforce, never
 * a figure a screen sent in. `null` when the plan is not in the result:
 * withdrawn since the results were drawn, or never in them.
 */
export async function pricePlanForLead(
  criteria: ComparisonRequestPayload,
  configurationId: string,
): Promise<PricedPlan | null> {
  const result = await runComparison(criteria);
  const plan = [...result.plans, ...result.overBudgetPlans].find(
    (candidate) => candidate.configurationId === configurationId,
  );
  return plan ? { plan, result, premium: presentPremium(plan) } : null;
}

/** Draw the document for a plan already priced. */
export async function renderPlanPdf(
  priced: PricedPlan,
  customerName: string,
): Promise<PlanDocumentFile> {
  const { plan, result } = priced;
  const [variant, product] = await Promise.all([
    getPlanConfiguration(plan.configurationId),
    getPlan(plan.planId),
  ]);

  return renderPlanDocument({
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
}
