/**
 * ============================================================================
 *  CENTRAL BUSINESS RULES
 * ============================================================================
 *
 * Single source of truth for business constants that the company may change.
 * This file intentionally contains **only plain values and no imports**, so it
 * can be referenced from anywhere (config, rules, API, UI) without creating
 * circular dependencies.
 *
 * RULE FOR THE WHOLE CODEBASE:
 *   Never write a business number or business string literal inside a React
 *   component, a route handler, or a service. Declare it here and import it.
 *
 * Derived logic that *uses* these constants lives in `src/rules/`.
 */

/**
 * Fixed average age used for every SME comparison.
 *
 * Business rule: SME insurance results are always quoted against a standard
 * average age. The employee never enters this value manually.
 *
 * Change this single constant if the company revises the standard.
 */
export const SME_FIXED_AVERAGE_AGE = 35;

/**
 * The age a comparison runs at when the customer states none.
 *
 * Every question on the comparison screen except "who do you want to insure"
 * may be left blank, and a blank age has to be SOME age — a plan is priced by
 * band, and a band cannot be read without one. It is the same standard age
 * SME cover is quoted against, so the business reasons about one age, not
 * two. Results built on it say so ("assumed"), because it is our assumption
 * and not the customer's answer.
 */
export const DEFAULT_COMPARISON_AGE = SME_FIXED_AVERAGE_AGE;

/**
 * What the coverage criterion reads as when the customer expressed no
 * preference and every scope was compared.
 */
export const ANY_COVERAGE_LABEL = 'Any coverage';

/**
 * What a price band reads as when the insurer left its premium blank.
 *
 * A blank premium is "not sold at this age" — an exclusion, never a free plan —
 * and the rate table a customer is shown has to say so in words rather than
 * leave a gap they might read as zero.
 */
export const NOT_SOLD_AT_AGE_LABEL = 'Not sold';

/**
 * WHAT A CORE AREA IS WORTH WHEN THE PLAN NAMES IT BUT STATES NO LIMIT.
 *
 * Insurers' own tables treat a covered benefit with no sub-limit as paid up
 * to the plan's overall ceiling — Allianz's Egypt table writes "Covered in
 * full, up to the maximum plan benefit", AXA Egypt writes a bare "Co-insurance
 * 30%" with no cap for medication — so that is the reading applied here:
 * the variant's annual limit stands in for the missing figure, and every
 * screen marks it as the annual limit rather than a figure the document gave.
 *
 * A blank limit is therefore never "not covered" and never "not specified":
 * AXA's tables state a co-payment on an area with no sub-limit of its own,
 * and that area is covered, up to the plan's ceiling.
 *
 * 'NOT_STATED' is the other defensible reading (score the area at the floor
 * and print "Not specified in plan"). One switch, so the business can change
 * its mind without a code change elsewhere.
 *
 * Decided 2026-09-09: annual limit, AND the import review flags every such
 * area for the employee to confirm before the plan can be published
 * (`MISSING_CORE_LIMIT_NEEDS_CONFIRMATION`). The assumption is the
 * industry's, but the insurer did not write the figure, so a person says
 * "yes, that is what this document means" before a customer sees it.
 */
export const MISSING_CORE_LIMIT_FALLBACK: 'ANNUAL_LIMIT' | 'NOT_STATED' = 'ANNUAL_LIMIT';

/** How a limit that came from the annual limit is marked: "EGP 200,000 (annual limit)". */
export const ASSUMED_LIMIT_LABEL = 'annual limit';

/**
 * Whether an imported plan with an unstated core limit waits for a person to
 * confirm the assumption before it can be published. The review screen reads
 * this; `importReviewWarnings()` in the rules decides which areas.
 */
export const MISSING_CORE_LIMIT_NEEDS_CONFIRMATION = true;

/**
 * A CO-PAYMENT THE DOCUMENT DOES NOT STATE IS NO CO-PAYMENT.
 *
 * Every core area carries a co-payment beside its figure. Left blank, the
 * plan pays in full for that area — the same reading a customer gives a
 * table that shows "EGP 2,000" with nothing beside it. So blank is 0, never
 * unknown, and the comparison scores it as such.
 */
export const CO_PAYMENT_WHEN_NOT_STATED = 0;

/** How a co-payment reads beside a figure: "EGP 1,500 · 10% co-pay". */
export const CO_PAYMENT_LABEL = 'co-pay';

/**
 * Wording used whenever a resolved average age is displayed or printed
 * (comparison screens, results, exports). Keep the phrasing here so it can be
 * changed in one place.
 */
export const AVERAGE_AGE_LABEL_PREFIX = 'Average age';

/**
 * Explanation shown to the employee next to an SME selection, so it is obvious
 * why no age input is offered.
 */
export const SME_FIXED_AVERAGE_AGE_NOTICE =
  'SME comparisons are always generated using the standard average age.';

/**
 * The age band a plan configuration may declare, and the ages a customer may
 * enter on the comparison screen.
 *
 * A single pair of bounds, so the admin form, the API validation and the
 * comparison input can never disagree about what counts as an age.
 */
export const MIN_INSURABLE_AGE = 0;
export const MAX_INSURABLE_AGE = 120;

/**
 * Widest possible band, used to open a configuration to every age.
 * Existing configurations were backfilled with this when the band became
 * mandatory, so nothing that used to match stopped matching.
 */
export const WIDEST_AGE_BAND = { from: MIN_INSURABLE_AGE, to: MAX_INSURABLE_AGE } as const;

/**
 * What a plan says where no figure was entered.
 *
 * A blank deductible, co-payment or limit does not mean zero and does not mean
 * "not covered" — it means the document the plan was taken from is silent. The
 * wording is a business decision, so it lives here and every screen reads it
 * from this constant.
 */
export const NOT_SPECIFIED_LABEL = 'Not specified in plan';

/**
 * The same fact, worded for a control the employee is filling in.
 *
 * EMPTY IS AN ANSWER: it says the document does not state this. So the blank
 * choice names itself rather than reading as an unfilled box, and nothing
 * anywhere turns it into 0.
 */
export const UNSPECIFIED_OPTION_LABEL = 'Not specified';
