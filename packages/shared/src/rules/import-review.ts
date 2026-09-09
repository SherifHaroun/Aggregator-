/**
 * WHAT AN IMPORTED PLAN MUST HAVE CONFIRMED BEFORE IT IS PUBLISHED.
 *
 * The import reads a document and fills the seven core areas. Where the
 * document names an area but states no ceiling, the comparison will use the
 * plan's annual limit (`MISSING_CORE_LIMIT_FALLBACK`) — the reading insurers'
 * own tables give a covered area with no sub-limit. That is the industry's
 * assumption, not the insurer's figure, so the review screen shows it as a
 * warning on the area, and the plan is not published until a person has
 * confirmed each one.
 *
 * Pure: the review screen and its tests call this with the draft it holds.
 */

import {
  ASSUMED_LIMIT_LABEL,
  MISSING_CORE_LIMIT_FALLBACK,
  MISSING_CORE_LIMIT_NEEDS_CONFIRMATION,
} from '../config/business-rules.js';
import { CORE_MEDICAL_BENEFITS } from '../config/medical-benefits.js';
import { formatMoney } from './insurance-labels.js';

/** A core area as the review screen holds it: the figure, or null when unstated. */
export interface ReviewedCoreBenefit {
  name: string;
  value: number | null;
}

/** As much of an imported plan as the warnings need. */
export interface ReviewedPlanDraft {
  name: string;
  currency: string | null;
  annualLimit: number | null;
  coreBenefits: readonly ReviewedCoreBenefit[];
}

export interface ImportReviewWarning {
  /** The plan the warning belongs to, as named on its card. */
  plan: string;
  /** The core area, by catalogue name. */
  benefit: string;
  /** What the employee is asked to confirm, in words. */
  message: string;
  /** Whether the plan waits on this being confirmed. */
  blocksPublish: boolean;
}

/** One key per warning, so a confirmation can be recorded against it. */
export function reviewWarningKey(warning: Pick<ImportReviewWarning, 'plan' | 'benefit'>): string {
  return `${warning.plan}::${warning.benefit}`;
}

/**
 * The warnings a plan's core areas raise.
 *
 * A LIMIT area with no figure is the only case. An area missing from the
 * draft altogether is the same as one present with null — the document was
 * silent either way. Zero raises nothing: it is the plan declining the area,
 * which the document said and the employee can see.
 */
export function importReviewWarnings(plan: ReviewedPlanDraft): ImportReviewWarning[] {
  const byName = new Map(
    plan.coreBenefits.map((benefit) => [benefit.name.trim().toLowerCase(), benefit.value]),
  );

  const warnings: ImportReviewWarning[] = [];
  for (const spec of CORE_MEDICAL_BENEFITS) {
    if (spec.valueKind !== 'LIMIT') continue;
    const value = byName.get(spec.name.toLowerCase()) ?? null;
    if (value !== null) continue;

    warnings.push({
      plan: plan.name,
      benefit: spec.name,
      message: unstatedLimitMessage(spec.name, plan),
      blocksPublish: MISSING_CORE_LIMIT_NEEDS_CONFIRMATION,
    });
  }
  return warnings;
}

function unstatedLimitMessage(benefit: string, plan: ReviewedPlanDraft): string {
  if (MISSING_CORE_LIMIT_FALLBACK === 'ANNUAL_LIMIT' && plan.annualLimit !== null) {
    return (
      `No ${benefit} limit is stated. It will be compared at the plan's ` +
      `${ASSUMED_LIMIT_LABEL} of ${formatMoney(plan.annualLimit, plan.currency)} ` +
      `and shown as "(${ASSUMED_LIMIT_LABEL})". Confirm that is what the document means.`
    );
  }
  if (MISSING_CORE_LIMIT_FALLBACK === 'ANNUAL_LIMIT') {
    return (
      `No ${benefit} limit is stated and the plan has no ${ASSUMED_LIMIT_LABEL} to fall back on. ` +
      `It will be compared as not specified. Enter the plan's ${ASSUMED_LIMIT_LABEL} or confirm.`
    );
  }
  return `No ${benefit} limit is stated. It will be compared as not specified. Confirm.`;
}

/**
 * Whether a plan may be published: every blocking warning has been confirmed.
 * Confirmations are the keys from `reviewWarningKey`.
 */
export function readyToPublish(
  warnings: readonly ImportReviewWarning[],
  confirmed: ReadonlySet<string>,
): boolean {
  return warnings.every(
    (warning) => !warning.blocksPublish || confirmed.has(reviewWarningKey(warning)),
  );
}
