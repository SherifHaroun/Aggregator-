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
import { NOT_SOLD_AT_AGE_LABEL, NOT_SPECIFIED_LABEL } from '../config/business-rules.js';
import { NOT_COVERED_LABEL, coverTermsSuffix } from './comparison-engine.js';
import { formatNumberValue as formatNumber } from './number-format.js';
import type { ComparisonBenefitCell, ComparisonPlanResult } from '../types/comparison-results.js';

/** A price band as the variant records it — the part of the DTO this reads. */
export interface PriceBandLike {
  ageFrom: number;
  ageTo: number;
  annualPrice: number | null;
}

/** One age band of a plan's rate table, ready to draw and to print. */
export interface PresentedPriceBand {
  ageFrom: number;
  ageTo: number;
  /** "18–25", or "65+" when the band runs to the oldest insurable age. */
  ageLabel: string;
  annualPrice: number | null;
  /** "EGP 3,100", or `NOT_SOLD_AT_AGE_LABEL` for a band with no premium. */
  display: string;
  /** Whether the band prices the comparison the plan was read in. */
  applies: boolean;
  /**
   * Where the band sits on an axis running the full width of the table,
   * 0..1 from the youngest age priced to the oldest. What a range bar draws.
   */
  start: number;
  end: number;
}

/** The whole rate table, ready to draw as one bar and print as one list. */
export interface PresentedPriceTable {
  bands: PresentedPriceBand[];
  /** The ages the axis runs between. */
  minAge: number;
  maxAge: number;
  /** The cheapest and dearest premiums, for a caption. `null` when none priced. */
  lowest: number | null;
  highest: number | null;
  /** Where on the axis the customer's own age falls, 0..1, or `null`. */
  marker: number | null;
}

/**
 * THE RATE TABLE, AS THE CUSTOMER READS IT.
 *
 * A comparison prices a plan at ONE age and shows one figure. The plan itself
 * is sold across many, and a customer choosing it — or choosing it for a
 * family — wants the whole table. This lays it out once for the page, the
 * preview and the PDF: youngest band first, the band that priced this
 * comparison marked, and each band placed on a 0..1 axis so any of them can
 * draw the same bar.
 *
 * `ages` is what the comparison ran at; `null` where the figure was built
 * some other way (an SME's workforce) and no single band applies.
 */
export function presentPriceBands(
  bands: readonly PriceBandLike[],
  currency: string | null,
  ages: { ageFrom: number; ageTo: number } | null,
  oldestInsurableAge: number,
): PresentedPriceTable {
  const sorted = [...bands].sort((a, b) => a.ageFrom - b.ageFrom || a.ageTo - b.ageTo);
  if (sorted.length === 0) {
    return { bands: [], minAge: 0, maxAge: 0, lowest: null, highest: null, marker: null };
  }

  const minAge = Math.min(...sorted.map((band) => band.ageFrom));
  const maxAge = Math.max(...sorted.map((band) => band.ageTo));

  /**
   * WHERE THE AXIS ENDS. An open-ended top band — "65+", recorded as running
   * to the oldest insurable age — is not sixty years of cover, it is "and
   * older". Drawn to scale it would take most of the bar and squash the ten
   * bands that carry the real prices into the rest, so it is given the width
   * of the widest ordinary band instead. The label already says "+".
   */
  const closed = sorted.filter((band) => band.ageTo < oldestInsurableAge);
  const widest = closed.length
    ? Math.max(...closed.map((band) => band.ageTo - band.ageFrom + 1))
    : 0;
  const axisEnd =
    maxAge >= oldestInsurableAge && closed.length
      ? Math.min(maxAge, Math.max(...sorted.map((band) => band.ageFrom)) + widest - 1)
      : maxAge;
  // A table of one age still needs a span to be drawn on.
  const span = Math.max(axisEnd + 1 - minAge, 1);
  const position = (age: number) => Math.min(Math.max((age - minAge) / span, 0), 1);

  const prices = sorted
    .map((band) => band.annualPrice)
    .filter((price): price is number => typeof price === 'number');

  return {
    bands: sorted.map((band) => ({
      ageFrom: band.ageFrom,
      ageTo: band.ageTo,
      ageLabel:
        band.ageTo >= oldestInsurableAge ? `${band.ageFrom}+` : `${band.ageFrom}–${band.ageTo}`,
      annualPrice: band.annualPrice,
      display:
        band.annualPrice === null
          ? NOT_SOLD_AT_AGE_LABEL
          : `${currency ? `${currency} ` : ''}${formatNumber(band.annualPrice)}`,
      applies:
        ages !== null &&
        band.annualPrice !== null &&
        band.ageFrom <= ages.ageFrom &&
        band.ageTo >= ages.ageTo,
      start: position(band.ageFrom),
      end: position(band.ageTo + 1),
    })),
    minAge,
    maxAge,
    lowest: prices.length ? Math.min(...prices) : null,
    highest: prices.length ? Math.max(...prices) : null,
    // The middle of the customer's own range, which for one person is their age.
    marker: ages === null ? null : position((ages.ageFrom + ages.ageTo) / 2 + 0.5),
  };
}

/** The seven areas, in the order the business reads them. Never re-sorted. */
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
  /** The share the member pays, or `null` for none. Already in `display`. */
  coPayment: number | null;
  /** The figure is the annual limit standing in for one the plan never gave. */
  limitAssumed: boolean;
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
  cell:
    | (Pick<ComparisonBenefitCell, 'value' | 'dataType' | 'unit' | 'display'> &
        Partial<Pick<ComparisonBenefitCell, 'coPayment' | 'limitAssumed'>>)
    | undefined,
  currency: string | null,
): { display: string; fraction: number | null } {
  if (!cell) return { display: NOT_SPECIFIED_LABEL, fraction: null };
  if (cell.value === 0) return { display: NOT_COVERED_LABEL, fraction: 0 };
  if (cell.value === null) {
    // A benefit quoted in words keeps its wording; a blank figure says so.
    return { display: cell.display || NOT_SPECIFIED_LABEL, fraction: null };
  }
  // The terms that qualify the figure travel with it wherever it is printed.
  const terms = coverTermsSuffix(cell.coPayment ?? null, cell.limitAssumed ?? false);
  if (cell.dataType === 'PERCENTAGE') {
    return {
      display: `${formatNumber(cell.value)}%${terms}`,
      fraction: Math.min(cell.value / 100, 1),
    };
  }
  if (cell.dataType === 'CURRENCY') {
    return {
      display: `${currency ? `${currency} ` : ''}${formatNumber(cell.value)}${terms}`,
      fraction: null,
    };
  }
  return { display: cell.display, fraction: null };
}

/**
 * THE SEVEN ROWS, ALWAYS SEVEN AND ALWAYS IN ORDER.
 *
 * A comparison only opens a column for an area some plan states, so a plan may
 * carry fewer than seven cells. The customer is still shown all seven: an area
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
      coPayment: cell?.coPayment ?? null,
      limitAssumed: cell?.limitAssumed ?? false,
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
