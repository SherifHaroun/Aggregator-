/**
 * ============================================================================
 *  HOW PLANS ARE SCORED AGAINST EACH OTHER
 * ============================================================================
 *
 * Business configuration for the comparison engine. Per the codebase rule, no
 * business number appears inside a service or a component — every constant the
 * company might revise lives here.
 *
 * Nothing in this file names a company, a plan or a benefit. It describes only
 * WHICH DIRECTION IS BETTER for a kind of value, and how much coverage matters
 * relative to price.
 */

/** Which way is better for a comparable value. */
export type ComparisonDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'NOT_COMPARABLE';

/**
 * The balance between "how good is the cover" and "what does it cost".
 *
 * Coverage outweighs price, which is what stops the engine from simply
 * recommending the cheapest plan; price still carries enough weight that extra
 * cover has to be worth what it costs. Both must sum to 1.
 */
export const COMPARISON_WEIGHTS = {
  coverage: 0.65,
  price: 0.35,
} as const;

/**
 * How much of the coverage score the plan-level attributes may account for.
 *
 * Small on purpose. The customer chose the benefits, so those must decide the
 * ranking; the attributes only separate plans that are otherwise close. Set
 * this too high and a plan covering NONE of the selected benefits can outscore
 * one that covers them all — which is exactly backwards.
 *
 * A plan that declares no attributes at all is judged on its benefits alone
 * rather than punished for the blanks.
 */
export const PLAN_ATTRIBUTE_SHARE = 0.2;

/**
 * The score floor for a benefit a plan actually provides.
 *
 * Normalising to 0..1 would give the weakest plan in the set exactly 0 — the
 * same as a plan that does not carry the benefit at all. Providing the least
 * cover is still not the same as providing none, so covered values are mapped
 * into [floor, 1] and 0 is reserved for "not covered".
 */
export const COVERED_SCORE_FLOOR = 0.15;

/**
 * A plan configuration attribute that takes part in scoring.
 *
 * These are columns of the configuration itself rather than benefits, which is
 * why their direction is declared here: a bigger annual limit is better.
 *
 * Deductible and co-payment stay in the list, DISABLED. The business does not
 * collect them any more — nothing on the variant editor asks for one — so a
 * column of blanks is all they could produce, and scoring on a figure nobody
 * enters ranks plans on which record happened to predate the change. They are
 * kept rather than deleted because the columns still hold what older records
 * stated, and turning one back on is the one edit it should take.
 */
export type PlanAttributeId = 'annualLimit' | 'deductible' | 'coPayment';

export interface PlanAttributeDefinition {
  id: PlanAttributeId;
  label: string;
  direction: ComparisonDirection;
  /** Rendered after the value, e.g. "%". `null` uses the plan currency. */
  unit: string | null;
  order: number;
  enabled: boolean;
}

export const PLAN_ATTRIBUTES: readonly PlanAttributeDefinition[] = [
  {
    id: 'annualLimit',
    label: 'Annual limit',
    direction: 'HIGHER_IS_BETTER',
    unit: null,
    order: 1,
    enabled: true,
  },
  {
    id: 'deductible',
    label: 'Deductible',
    direction: 'LOWER_IS_BETTER',
    unit: null,
    order: 2,
    enabled: false,
  },
  {
    id: 'coPayment',
    label: 'Co-payment',
    direction: 'LOWER_IS_BETTER',
    unit: '%',
    order: 3,
    enabled: false,
  },
];

/** Enabled plan attributes in display order. */
export function listPlanAttributes(): PlanAttributeDefinition[] {
  return PLAN_ATTRIBUTES.filter((attribute) => attribute.enabled).sort((a, b) => a.order - b.order);
}

/**
 * How much better one plan's coverage must be, in normalised points, before a
 * tie is called a real difference. Guards against floating-point noise deciding
 * a recommendation.
 */
export const COMPARISON_TIE_EPSILON = 0.0001;
