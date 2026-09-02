/**
 * HOW A PLAN READS TO A CUSTOMER.
 *
 * One place, because the same six rows appear on a comparison card, in the
 * plan preview, on the full plan page and in the PDF that gets emailed to the
 * customer. Four renderings of one plan that disagreed about what "0" meant
 * would be four chances to mis-sell it.
 *
 * Nothing here decides anything. The figures come from the comparison engine
 * exactly as it scored them; this only says how they are written down.
 */

import { CORE_MEDICAL_BENEFITS } from '../config/medical-benefits.js';
import { NOT_SPECIFIED_LABEL } from '../config/business-rules.js';
import { NOT_COVERED_LABEL } from './comparison-engine.js';
import { formatNumberValue as formatNumber } from './number-format.js';
import type { ComparisonBenefitCell, ComparisonPlanResult } from '../types/comparison-results.js';

/** The six areas, in the order the business reads them. Never re-sorted. */
export const CORE_BENEFIT_ORDER: readonly string[] = [...CORE_MEDICAL_BENEFITS]
  .sort((a, b) => a.order - b.order)
  .map((benefit) => benefit.name);

export interface PresentedBenefit {
  name: string;
  /** Ready to print: "100%", "EGP 750", "Not covered", "Not specified in plan". */
  display: string;
  /** 0..1 for a percentage, so a bar can be drawn. `null` for a ceiling. */
  fraction: number | null;
  /** Whether the plan states anything at all about this area. */
  stated: boolean;
  /** The qualifications the plan attaches to this figure. */
  limitations: string[];
}

/**
 * What a figure says, in the customer's terms.
 *
 * A ZERO is the plan declining the area and a BLANK is the plan not saying —
 * two different facts, and the whole reason this is not a `?? 0`.
 */
export function presentBenefitValue(
  cell: Pick<ComparisonBenefitCell, 'value' | 'dataType' | 'unit' | 'display'> | undefined,
  currency: string | null,
): { display: string; fraction: number | null } {
  if (!cell) return { display: NOT_SPECIFIED_LABEL, fraction: null };
  if (cell.value === 0) return { display: NOT_COVERED_LABEL, fraction: 0 };
  if (cell.value === null) {
    // A benefit quoted in words keeps its wording; a blank figure says so.
    return { display: cell.display || NOT_SPECIFIED_LABEL, fraction: null };
  }
  if (cell.dataType === 'PERCENTAGE') {
    return { display: `${formatNumber(cell.value)}%`, fraction: Math.min(cell.value / 100, 1) };
  }
  if (cell.dataType === 'CURRENCY') {
    return {
      display: `${currency ? `${currency} ` : ''}${formatNumber(cell.value)}`,
      fraction: null,
    };
  }
  return { display: cell.display, fraction: null };
}

/**
 * THE SIX ROWS, ALWAYS SIX AND ALWAYS IN ORDER.
 *
 * A comparison only opens a column for an area some plan states, so a plan may
 * carry fewer than six cells. The customer is still shown all six: an area
 * missing from the table would read as an area that does not exist, when what
 * it means is that nobody wrote a figure down.
 */
export function presentCoreBenefits(plan: ComparisonPlanResult): PresentedBenefit[] {
  const byName = new Map(plan.benefits.map((cell) => [cell.optionName, cell]));

  return CORE_BENEFIT_ORDER.map((name) => {
    const cell = byName.get(name);
    const { display, fraction } = presentBenefitValue(cell, plan.currency);
    return {
      name,
      display,
      fraction,
      stated: cell !== undefined && cell.value !== null,
      limitations: cell?.limitations.map((limitation) => limitation.name) ?? [],
    };
  });
}

/** The ceiling this plan pays to, ready to print. */
export function presentAnnualLimit(plan: ComparisonPlanResult): string {
  const attribute = plan.attributes.find((item) => item.id === 'annualLimit');
  if (!attribute || attribute.value === null) return NOT_SPECIFIED_LABEL;
  return `${plan.currency ? `${plan.currency} ` : ''}${formatNumber(attribute.value)}`;
}

/** The premium, ready to print. */
export function presentPremium(plan: ComparisonPlanResult): string {
  if (plan.annualPrice === null) return NOT_SPECIFIED_LABEL;
  return `${plan.currency ? `${plan.currency} ` : ''}${formatNumber(plan.annualPrice)}`;
}

/**
 * What the file is called when a customer saves it.
 *
 * Named for the company and plan so a folder of them can be told apart —
 * "download.pdf" three times over is a folder nobody can use.
 */
export function planDocumentFilename(companyName: string, planName: string): string {
  const slug = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const parts = [slug(companyName), slug(planName)].filter(Boolean);
  return `${parts.join('-') || 'Plan'}-Plan-Details.pdf`;
}
