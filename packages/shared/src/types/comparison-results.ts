/**
 * Contracts for running a comparison and rendering its results.
 *
 * As everywhere else in this package, nothing here names a company, a plan or
 * a benefit: those are database records. These types describe only the SHAPE of
 * a comparison request and of the answer the engine produces.
 */

import type { ComparisonDirection, PlanAttributeId } from '../config/comparison-scoring.js';
import type { CustomerTypeId } from '../config/customer-types.js';
import type { GeographicalCoverageId } from '../config/geographical-coverage.js';
import type { OptionFieldDataType } from '../config/option-field-types.js';
import type { ResolvedAverageAge } from './comparison.js';

/**
 * What the customer asked for. Every id refers to a database record.
 *
 * Note what is NOT here: benefits. The customer states requirements, and the
 * system works out which benefits the matching plans provide — so the
 * comparison covers whatever those plans carry, including a benefit created
 * after this code was written.
 */
export interface ComparisonRequestInput {
  insuranceTypeId: string;
  customerTypeId: CustomerTypeId;
  geographicalCoverageId: GeographicalCoverageId;
  /** ISO 4217 code, e.g. "EGP". Configurations priced differently are excluded. */
  currency: string;
  /**
   * The ages to be covered, youngest to oldest.
   *
   * One person is simply a range of one (`ageFrom === ageTo`), so there is a
   * single matching rule rather than two: a configuration qualifies only when
   * its own band SPANS the whole request —
   * `config.ageFrom <= ageFrom && config.ageTo >= ageTo`. A family is not
   * offered a plan that would leave its youngest or eldest uncovered.
   */
  ageFrom: number;
  ageTo: number;
  /**
   * What the customer is comfortable paying per year, in `currency`.
   *
   * Optional: left out, no price ceiling is applied and every matching plan is
   * considered. That is what the comparison screen's "work it out for me"
   * budget resolves to when the filters match nothing to price against.
   */
  budget?: number;
}

/**
 * What the plans matching everything-except-budget actually cost.
 *
 * Lets the comparison screen propose a budget from real prices instead of
 * asking the employee to guess one, and show the range it came from.
 */
export interface ComparisonPriceRangeDto {
  /** Configurations matching the other requirements. */
  count: number;
  lowestPrice: number | null;
  highestPrice: number | null;
  /**
   * The budget to use when the employee asks for one to be worked out: the
   * dearest matching plan, so nothing is excluded on price and the
   * recommendation is decided purely on value. `null` when nothing matched.
   */
  suggestedBudget: number | null;
  currency: string;
}

/** One selected benefit as it applies to ONE plan configuration. */
export interface ComparisonBenefitCell {
  optionId: string;
  optionName: string;
  /** `false` when this plan does not carry the benefit at all. */
  covered: boolean;
  /** Numeric value used for ranking. `null` when not covered or not numeric. */
  value: number | null;
  /** Ready to render, e.g. "85%" or "Not covered". */
  display: string;
  dataType: OptionFieldDataType | null;
  unit: string | null;
  direction: ComparisonDirection;
  /** 0..1 against the other MATCHING plans. 0 when the benefit is missing. */
  score: number;
  /** No other matching plan does better on this benefit. */
  isBest: boolean;
}

/** A plan-level attribute (annual limit, deductible, co-payment). */
export interface ComparisonAttributeCell {
  id: PlanAttributeId;
  label: string;
  value: number | null;
  display: string;
  direction: ComparisonDirection;
  score: number;
  isBest: boolean;
}

/** One matching plan configuration, scored against the others. */
export interface ComparisonPlanResult {
  configurationId: string;
  planId: string;
  planName: string;
  planCategory: string | null;
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;

  currency: string | null;
  annualPrice: number | null;
  customerTypeLabel: string;
  geographicalCoverageLabel: string;

  benefits: ComparisonBenefitCell[];
  attributes: ComparisonAttributeCell[];

  /** 0..1. How strong this plan's cover is against the other matching plans. */
  coverageScore: number;
  /** 0..1. 1 is the cheapest matching plan. */
  priceScore: number;
  /** 0..1. The weighted trade-off that ranks the results. */
  valueScore: number;

  /** How many of the selected benefits this plan does not carry. */
  missingBenefitCount: number;

  /** Another plan costs no more and covers at least as much on everything. */
  isDominated: boolean;
  /** Configuration ids that dominate this one. */
  dominatedBy: string[];

  isRecommended: boolean;
  isCheapest: boolean;
  isHighestCoverage: boolean;
}

/** The selections echoed back, resolved to labels. */
export interface ResolvedComparisonRequest {
  insuranceTypeId: string;
  insuranceTypeName: string;
  customerTypeId: CustomerTypeId;
  customerTypeLabel: string;
  geographicalCoverageId: GeographicalCoverageId;
  geographicalCoverageLabel: string;
  currency: string;
  ageFrom: number;
  ageTo: number;
  /** `null` when no ceiling was applied. */
  budget: number | null;
  averageAge: ResolvedAverageAge;
  /** The benefits found on the matching plans, in the order they are compared. */
  benefits: { id: string; name: string }[];
}

/** The full answer: what matched, how it scored, and what is recommended. */
export interface ComparisonResultDto {
  criteria: ResolvedComparisonRequest;
  /** Best value first. */
  plans: ComparisonPlanResult[];
  recommendedConfigurationId: string | null;
  /**
   * Why that plan won, generated from the actual numbers of THIS comparison.
   * Empty when nothing matched.
   */
  recommendationReasons: string[];
  /** Configurations that matched every requirement, budget included. */
  matchedCount: number;

  /**
   * The plans that matched everything EXCEPT the budget — shown beneath the
   * affordable ones so the customer can see what the next bracket up buys.
   *
   * Scored as their OWN set, not against the affordable plans: "best value
   * above your budget" is only a meaningful statement among the plans above
   * it. Their presence never influences the recommendation below the budget.
   */
  overBudgetPlans: ComparisonPlanResult[];
  /** The benefits found on those plans, in the order their table compares them. */
  overBudgetBenefits: { id: string; name: string }[];
  /** Best value among the plans above the budget. */
  overBudgetRecommendedConfigurationId: string | null;
  overBudgetRecommendationReasons: string[];
  /** How many matched everything except the budget. */
  overBudgetCount: number;
}
