/**
 * ============================================================================
 *  THE COMPARISON ENGINE
 * ============================================================================
 *
 * Given the plan configurations that already match what the customer asked for,
 * decide how good each one is and which represents the best value.
 *
 * Two rules drive everything here:
 *
 *  1. A value is only meaningful NEXT TO THE OTHER MATCHING PLANS. 80% is
 *     excellent against 60% and poor against 95%, so every value is normalised
 *     across the candidate set rather than summed into a raw total.
 *
 *  2. The cheapest plan is not automatically the answer, and neither is the
 *     richest. Coverage and price are scored separately and weighed against
 *     each other, so extra cover only wins when it is worth what it costs.
 *
 * Pure and database-free on purpose: the API owns the query, this owns the
 * judgement, and both can be tested apart.
 */

import {
  COMPARISON_TIE_EPSILON,
  COMPARISON_WEIGHTS,
  COVERED_SCORE_FLOOR,
  PLAN_ATTRIBUTE_SHARE,
  listPlanAttributes,
  type ComparisonDirection,
  type PlanAttributeId,
} from '../config/comparison-scoring.js';
import { NOT_SPECIFIED_LABEL } from '../config/business-rules.js';
import { OPTION_FIELD_DATA_TYPES } from '../config/option-field-types.js';
import type { OptionFieldDataType } from '../config/option-field-types.js';
import { describeLimitations, limitationFactor, type AppliedLimitation } from './limitations.js';
import { formatNumberValue } from './number-format.js';
import type {
  ComparisonAttributeCell,
  ComparisonBenefitCell,
  ComparisonPlanResult,
} from '../types/comparison-results.js';

/** A benefit the customer selected, as it applies to one candidate. */
export interface CandidateBenefit {
  optionId: string;
  optionName: string;
  /** `null` when the plan does not carry this benefit at all. */
  value: number | null;
  dataType: OptionFieldDataType | null;
  unit: string | null;
  /**
   * The qualifications this plan attaches to the benefit. An empty list is
   * unrestricted cover, not missing information.
   */
  limitations: AppliedLimitation[];
  /**
   * Whether the plan carries this benefit AT ALL.
   *
   * Distinct from having a rankable number. A benefit quoted in words — a
   * provider network, "covered at authorized centers" — carries no figure, but
   * a plan that provides it is plainly not equal to a plan that does not. That
   * used to be indistinguishable, so both scored zero; this is what tells them
   * apart.
   */
  carried: boolean;
  /** The wording a benefit is quoted in, when it is not quoted as a number. */
  textValue: string | null;
}

/** One plan configuration that already matched the customer's criteria. */
export interface ComparisonCandidate {
  configurationId: string;
  planId: string;
  planName: string;
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  currency: string | null;
  annualPrice: number | null;
  annualLimit: number | null;
  deductible: number | null;
  coPayment: number | null;
  customerTypeLabel: string;
  geographicalCoverageLabel: string;
  /** One entry per SELECTED benefit, in the order the customer chose them. */
  benefits: CandidateBenefit[];
}

/** Direction for a benefit, taken from its field's data type. */
function directionFor(dataType: OptionFieldDataType | null): ComparisonDirection {
  return dataType ? OPTION_FIELD_DATA_TYPES[dataType].comparison : 'NOT_COMPARABLE';
}

/**
 * Position a value between the worst and best of the candidate set, as 0..1.
 *
 * When every candidate holds the same value nobody is better than anybody, so
 * they all score full marks and the dimension simply stops discriminating.
 */
function normalise(
  value: number,
  min: number,
  max: number,
  direction: ComparisonDirection,
): number {
  if (max - min <= COMPARISON_TIE_EPSILON) return 1;
  const position = (value - min) / (max - min);
  return direction === 'LOWER_IS_BETTER' ? 1 - position : position;
}

/**
 * The same, lifted clear of zero.
 *
 * Used for benefits a plan DOES provide, so the weakest cover in the set still
 * outranks no cover at all.
 */
function normaliseCovered(
  value: number,
  min: number,
  max: number,
  direction: ComparisonDirection,
): number {
  return COVERED_SCORE_FLOOR + (1 - COVERED_SCORE_FLOOR) * normalise(value, min, max, direction);
}

/** Best value present in a set, honouring the direction. */
function bestOf(values: number[], direction: ComparisonDirection): number | null {
  if (values.length === 0) return null;
  return direction === 'LOWER_IS_BETTER' ? Math.min(...values) : Math.max(...values);
}

/** How a benefit value reads on screen. */
function displayBenefit(benefit: CandidateBenefit): string {
  /**
   * A rank is a number only so that it can be sorted. Nobody wants to read
   * "Medical Network: 2" — they want the name of the network, which is what
   * the plan actually says.
   */
  if (benefit.dataType === 'RANK') {
    return benefit.textValue?.trim() || (benefit.carried ? COVERED_LABEL : NOT_COVERED_LABEL);
  }

  if (benefit.value === null) {
    if (!benefit.carried) return NOT_COVERED_LABEL;
    // Carried but not quoted as a number: show the wording, or say plainly
    // that it is provided. Never "Not covered", which would be false.
    return benefit.textValue?.trim() || COVERED_LABEL;
  }
  const unit = benefit.unit ?? (benefit.dataType === 'PERCENTAGE' ? '%' : '');
  return unit ? `${formatNumber(benefit.value)}${unit}` : formatNumber(benefit.value);
}

/** Shown wherever a plan does not carry a selected benefit. Never "0" or "100%". */
export const NOT_COVERED_LABEL = 'Not covered';

/** Shown for a benefit a plan provides but does not put a figure on. */
export const COVERED_LABEL = 'Covered';

/** Plain number formatting, grouped, without inventing decimals. */
export const formatNumber = formatNumberValue;

/**
 * Score every candidate and rank them.
 *
 * Coverage first: each selected benefit is normalised across the candidates and
 * averaged, so a plan is measured on the benefits the customer actually asked
 * for. A benefit a plan does not carry scores zero — never full marks, and
 * never quietly skipped, which is what makes a plan missing cover rank below an
 * otherwise equal plan that provides it.
 *
 * Then price, then the trade-off between them.
 */
export function scoreCandidates(candidates: ComparisonCandidate[]): ComparisonPlanResult[] {
  if (candidates.length === 0) return [];

  const attributes = listPlanAttributes();

  // --- per-benefit ranges, across the candidate set --------------------------
  const benefitIds = candidates[0]!.benefits.map((benefit) => benefit.optionId);

  const benefitRange = new Map<string, { min: number; max: number; best: number | null }>();
  for (const optionId of benefitIds) {
    const direction = directionFor(
      candidates[0]!.benefits.find((b) => b.optionId === optionId)?.dataType ?? null,
    );
    const values = candidates
      .map((candidate) => candidate.benefits.find((b) => b.optionId === optionId)?.value)
      .filter((value): value is number => typeof value === 'number');
    benefitRange.set(optionId, {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      best: bestOf(values, direction),
    });
  }

  // --- per-attribute ranges --------------------------------------------------
  const attributeRange = new Map<
    PlanAttributeId,
    { min: number; max: number; best: number | null }
  >();
  for (const attribute of attributes) {
    const values = candidates
      .map((candidate) => candidate[attribute.id])
      .filter((value): value is number => typeof value === 'number');
    attributeRange.set(attribute.id, {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      best: bestOf(values, attribute.direction),
    });
  }

  // --- price range -----------------------------------------------------------
  const prices = candidates
    .map((candidate) => candidate.annualPrice)
    .filter((price): price is number => typeof price === 'number');
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;

  // --- score each candidate --------------------------------------------------
  const scored = candidates.map((candidate) => {
    const benefits: ComparisonBenefitCell[] = candidate.benefits.map((benefit) => {
      const direction = directionFor(benefit.dataType);
      const range = benefitRange.get(benefit.optionId)!;
      const covered = benefit.carried;
      const comparable = benefit.value !== null && direction !== 'NOT_COMPARABLE';

      /**
       * What the figure is worth BEFORE its conditions are read.
       *
       * A benefit quoted in words rather than numbers starts at full marks:
       * there is no scale to place it on, and "provided" is the best a plan
       * can say about it. Its conditions are then what separate one plan's
       * physiotherapy from another's.
       */
      const rawScore = comparable
        ? normaliseCovered(benefit.value!, range.min, range.max, direction)
        : covered
          ? 1
          : 0;

      /**
       * The conditions attached to it. 1 when none are, so a plan is only ever
       * marked down for a restriction somebody actually recorded.
       */
      const factor = limitationFactor(benefit.limitations);

      return {
        optionId: benefit.optionId,
        optionName: benefit.optionName,
        covered,
        value: benefit.value,
        display: displayBenefit(benefit),
        dataType: benefit.dataType,
        unit: benefit.unit,
        direction,
        // Missing cover scores zero. It is never treated as full cover, and
        // never ties with the weakest plan that does provide the benefit —
        // however heavily that plan's cover is qualified.
        score: covered ? Math.max(COVERED_SCORE_FLOOR, rawScore * factor) : 0,
        // Decided below, once every candidate's conditions have been applied.
        isBest: false,
        limitations: benefit.limitations.map((limitation) => ({
          id: limitation.id,
          name: limitation.name,
        })),
        limitationsDisplay: describeLimitations(benefit.limitations),
        limitationFactor: factor,
      };
    });

    const attributeCells: ComparisonAttributeCell[] = attributes.map((attribute) => {
      const value = candidate[attribute.id];
      const range = attributeRange.get(attribute.id)!;
      const present = typeof value === 'number';
      const unit = attribute.unit ?? (candidate.currency ? ` ${candidate.currency}` : '');

      return {
        id: attribute.id,
        label: attribute.label,
        value: present ? value : null,
        display: present ? `${formatNumber(value)}${unit}` : NOT_SPECIFIED_LABEL,
        direction: attribute.direction,
        score: present ? normalise(value, range.min, range.max, attribute.direction) : 0,
        isBest: present && range.best !== null && value === range.best,
      };
    });

    /**
     * The benefits the customer selected decide the score; the plan attributes
     * only refine it, and only up to `PLAN_ATTRIBUTE_SHARE`. This ordering is
     * what stops a plan with a generous annual limit but none of the requested
     * cover from beating a plan that actually provides it.
     *
     * An attribute this plan leaves blank is not scored at all rather than
     * scored zero: an undeclared deductible is unknown, not bad. A plan that
     * declares none is judged purely on its benefits.
     */
    const benefitScore =
      benefits.length > 0
        ? benefits.reduce((total, benefit) => total + benefit.score, 0) / benefits.length
        : 0;

    const declared = attributeCells.filter(
      (cell) => cell.value !== null && attributeRange.get(cell.id)!.best !== null,
    );
    const attributeScore =
      declared.length > 0
        ? declared.reduce((total, cell) => total + cell.score, 0) / declared.length
        : null;

    const coverageScore =
      attributeScore === null
        ? benefitScore
        : benefitScore * (1 - PLAN_ATTRIBUTE_SHARE) + attributeScore * PLAN_ATTRIBUTE_SHARE;
    const priceScore =
      candidate.annualPrice === null
        ? 0
        : normalise(candidate.annualPrice, priceMin, priceMax, 'LOWER_IS_BETTER');

    return {
      candidate,
      benefits,
      attributes: attributeCells,
      coverageScore,
      priceScore,
      valueScore:
        coverageScore * COMPARISON_WEIGHTS.coverage + priceScore * COMPARISON_WEIGHTS.price,
      missingBenefitCount: benefits.filter((benefit) => !benefit.covered).length,
    };
  });

  /**
   * Which plan actually holds a benefit best — decided on the FINAL score, so
   * the conditions count.
   *
   * The largest figure is not automatically the winner: 800 EGP for basic
   * procedures only is worth less than 800 EGP for everything, and marking the
   * restricted one "best" would contradict the ranking on the same screen.
   * Genuine ties are all marked, as they were before.
   */
  for (const [index] of (scored[0]?.benefits ?? []).entries()) {
    const cells = scored.map((entry) => entry.benefits[index]!).filter((cell) => cell.covered);
    if (cells.length === 0) continue;
    const best = Math.max(...cells.map((cell) => cell.score));
    for (const cell of cells) cell.isBest = cell.score + COMPARISON_TIE_EPSILON >= best;
  }

  /**
   * Dominance: a plan costs no more and is at least as good on every selected
   * benefit, beating it on at least one. A dominated plan can never be the
   * recommendation — there is a strictly better deal on the table.
   */
  const dominatedBy = new Map<string, string[]>();
  for (const subject of scored) {
    const dominators: string[] = [];
    for (const rival of scored) {
      if (rival === subject) continue;
      if (rival.candidate.annualPrice === null || subject.candidate.annualPrice === null) continue;
      if (rival.candidate.annualPrice > subject.candidate.annualPrice) continue;

      let atLeastAsGoodEverywhere = true;
      let betterSomewhere = rival.candidate.annualPrice < subject.candidate.annualPrice;

      for (const [index, cell] of subject.benefits.entries()) {
        const rivalCell = rival.benefits[index]!;
        /**
         * Every benefit counts here, including those quoted in words. Their
         * score now carries real information — whether the plan provides the
         * benefit, and under what conditions — so skipping them would let a
         * plan dominate another it is plainly worse than.
         */
        if (rivalCell.score + COMPARISON_TIE_EPSILON < cell.score) {
          atLeastAsGoodEverywhere = false;
          break;
        }
        if (rivalCell.score > cell.score + COMPARISON_TIE_EPSILON) betterSomewhere = true;
      }

      if (atLeastAsGoodEverywhere && betterSomewhere) {
        dominators.push(rival.candidate.configurationId);
      }
    }
    dominatedBy.set(subject.candidate.configurationId, dominators);
  }

  const cheapest = scored.reduce<(typeof scored)[number] | null>((best, current) => {
    if (current.candidate.annualPrice === null) return best;
    if (!best || current.candidate.annualPrice < best.candidate.annualPrice!) return current;
    return best;
  }, null);

  const highestCoverage = scored.reduce((best, current) =>
    current.coverageScore > best.coverageScore + COMPARISON_TIE_EPSILON ? current : best,
  );

  /**
   * The recommendation: the best trade-off among plans nothing else dominates.
   *
   * Ties break deterministically — better cover first, then the lower price,
   * then the configuration id — so the same data always produces the same
   * answer.
   */
  const eligible = scored.filter(
    (entry) => (dominatedBy.get(entry.candidate.configurationId) ?? []).length === 0,
  );
  const recommended = (eligible.length > 0 ? eligible : scored).slice().sort(compareForRank)[0];

  const results: ComparisonPlanResult[] = scored
    .slice()
    .sort(compareForRank)
    .map((entry) => ({
      configurationId: entry.candidate.configurationId,
      planId: entry.candidate.planId,
      planName: entry.candidate.planName,
      companyId: entry.candidate.companyId,
      companyName: entry.candidate.companyName,
      companyLogoUrl: entry.candidate.companyLogoUrl,
      currency: entry.candidate.currency,
      annualPrice: entry.candidate.annualPrice,
      customerTypeLabel: entry.candidate.customerTypeLabel,
      geographicalCoverageLabel: entry.candidate.geographicalCoverageLabel,
      benefits: entry.benefits,
      attributes: entry.attributes,
      coverageScore: entry.coverageScore,
      priceScore: entry.priceScore,
      valueScore: entry.valueScore,
      missingBenefitCount: entry.missingBenefitCount,
      isDominated: (dominatedBy.get(entry.candidate.configurationId) ?? []).length > 0,
      dominatedBy: dominatedBy.get(entry.candidate.configurationId) ?? [],
      isRecommended: entry === recommended,
      isCheapest: cheapest !== null && entry === cheapest,
      isHighestCoverage: entry === highestCoverage,
    }));

  return results;
}

/** Deterministic ranking: value, then cover, then price, then id. */
function compareForRank(
  a: { valueScore: number; coverageScore: number; candidate: ComparisonCandidate },
  b: { valueScore: number; coverageScore: number; candidate: ComparisonCandidate },
): number {
  if (Math.abs(a.valueScore - b.valueScore) > COMPARISON_TIE_EPSILON) {
    return b.valueScore - a.valueScore;
  }
  if (Math.abs(a.coverageScore - b.coverageScore) > COMPARISON_TIE_EPSILON) {
    return b.coverageScore - a.coverageScore;
  }
  const priceA = a.candidate.annualPrice ?? Number.POSITIVE_INFINITY;
  const priceB = b.candidate.annualPrice ?? Number.POSITIVE_INFINITY;
  if (priceA !== priceB) return priceA - priceB;
  return a.candidate.configurationId.localeCompare(b.candidate.configurationId);
}

/**
 * Explain the recommendation in the customer's own terms.
 *
 * Every sentence is built from the numbers of THIS comparison — which plan was
 * cheaper, by how much, and what extra cover the money bought. Nothing is
 * pre-written for a particular outcome, so the wording changes with the data.
 */
export function explainRecommendation(plans: ComparisonPlanResult[]): string[] {
  const winner = plans.find((plan) => plan.isRecommended);
  if (!winner) return [];

  const reasons: string[] = [];
  const money = (plan: ComparisonPlanResult) =>
    plan.annualPrice === null
      ? 'an unpriced plan'
      : `${formatNumber(plan.annualPrice)}${plan.currency ? ` ${plan.currency}` : ''}`;

  const cheaper = plans.filter(
    (plan) =>
      plan !== winner &&
      plan.annualPrice !== null &&
      winner.annualPrice !== null &&
      plan.annualPrice < winner.annualPrice,
  );
  const richer = plans.filter(
    (plan) => plan !== winner && plan.coverageScore > winner.coverageScore + COMPARISON_TIE_EPSILON,
  );

  /**
   * When this plan records none of the benefits the comparison found, calling
   * it "strongest on the benefits these plans cover" would be true only in the
   * arithmetic and false to a reader. Say what actually decided it.
   */
  const coversNothing =
    winner.benefits.length > 0 && winner.missingBenefitCount === winner.benefits.length;

  if (coversNothing) {
    reasons.push(
      `No matching plan records any benefit, so this one leads on price and plan limits alone${
        winner.annualPrice === null ? '' : `, at ${money(winner)}`
      }.`,
    );
  } else if (winner.isCheapest && winner.isHighestCoverage) {
    reasons.push(
      `It is both the cheapest match at ${money(winner)} and the strongest on the benefits these plans cover, so nothing else offers more for less.`,
    );
  } else if (winner.isCheapest) {
    reasons.push(
      `It is the cheapest match at ${money(winner)}, and no more expensive plan improves cover enough to justify the difference.`,
    );
  } else if (cheaper.length > 0) {
    // What the extra money bought, measured on the selected benefits.
    const bestCheaper = cheaper.reduce((best, plan) =>
      plan.coverageScore > best.coverageScore ? plan : best,
    );
    const gained = describeCoverageGap(winner, bestCheaper);
    reasons.push(
      gained
        ? `It covers ${gained} more than ${bestCheaper.companyName}'s cheaper ${bestCheaper.planName}, which is worth the ${money(winner)} against ${money(bestCheaper)}.`
        : `At ${money(winner)} it gives stronger overall cover than the cheaper matches.`,
    );
  }

  if (richer.length > 0) {
    const nearest = richer.reduce((closest, plan) =>
      (plan.annualPrice ?? Infinity) < (closest.annualPrice ?? Infinity) ? plan : closest,
    );
    if (nearest.annualPrice !== null && winner.annualPrice !== null) {
      const extra = nearest.annualPrice - winner.annualPrice;
      if (extra > 0) {
        const gap = describeCoverageGap(nearest, winner);
        reasons.push(
          gap
            ? `${nearest.companyName}'s ${nearest.planName} covers ${gap} more, but costs a further ${formatNumber(extra)}${winner.currency ? ` ${winner.currency}` : ''} — too little gain for the price.`
            : `${nearest.companyName}'s ${nearest.planName} scores slightly higher but costs a further ${formatNumber(extra)}${winner.currency ? ` ${winner.currency}` : ''}.`,
        );
      }
    }
  }

  const dominatedCount = plans.filter((plan) => plan.isDominated).length;
  if (dominatedCount > 0) {
    reasons.push(
      `${dominatedCount} other ${dominatedCount === 1 ? 'plan was' : 'plans were'} ruled out for costing more while covering no more.`,
    );
  }

  // Already said above when it covers nothing at all.
  if (winner.missingBenefitCount > 0 && !coversNothing) {
    reasons.push(
      `Note that it does not cover ${winner.missingBenefitCount} of the benefits the other matching plans provide — no matching plan covered ${winner.missingBenefitCount === 1 ? 'it' : 'all of them'} better overall.`,
    );
  }

  return reasons;
}

/** "Dental (80% vs 50%)" for the benefits where `plan` beats `other`. */
function describeCoverageGap(plan: ComparisonPlanResult, other: ComparisonPlanResult): string {
  const gains = plan.benefits
    .map((cell, index) => ({ cell, rival: other.benefits[index]! }))
    .filter(({ cell, rival }) => cell.covered && cell.score > rival.score + COMPARISON_TIE_EPSILON)
    .map(({ cell, rival }) =>
      /**
       * Two plans can quote the same figure and still differ, because one
       * attaches conditions the other does not. Saying "800 vs 800" would read
       * as a mistake, so name the conditions that actually separate them.
       */
      cell.display === rival.display
        ? `${cell.optionName} (${cell.limitationsDisplay.toLowerCase()}, against ${rival.limitationsDisplay.toLowerCase()})`
        : `${cell.optionName} (${cell.display} vs ${rival.display})`,
    );

  if (gains.length === 0) return '';
  if (gains.length <= 2) return gains.join(' and ');
  return `${gains.slice(0, 2).join(', ')} and ${gains.length - 2} more`;
}
