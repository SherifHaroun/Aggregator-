/**
 * ============================================================================
 *  SETTINGS THAT TAKE SEVERAL ANSWERS, AND WHAT THEY COST
 * ============================================================================
 *
 * A plan document rarely states cover as a bare figure. It says "800 EGP for
 * BASIC PROCEDURES", "100% IN-NETWORK ONLY", "covered AT AUTHORIZED CENTERS".
 * Those qualifications decide what the cover is actually worth, and while they
 * sat in a free-text note the comparison could not read them — so two plans
 * quoting 800 EGP scored identically whether one paid for everything and the
 * other only for fillings.
 *
 * They are therefore RECORDS, ticked on a setting that belongs to one benefit.
 * Inpatient cover has its own settings — coverage, co-payment, network access,
 * room type, ICU, what is included — and each owns the answers it offers.
 * "Private room" is not an answer to "what percentage", and "1 in 20 members
 * ratio" has nothing to say about a room.
 *
 * THE ANSWER LIST IS RANKED, AND THE RANK IS THE JUDGEMENT.
 *
 * How much a condition costs is not something code can know. So each setting's
 * list is ordered MILDEST FIRST, and that order is the whole of it: the person
 * who knows the market decides that basic-procedures-only costs more than a
 * co-payment by dragging one above the other. No weight is typed, and none is
 * invented here.
 *
 * Ranking is RELATIVE TO ITS OWN LIST, exactly as the plan comparison is
 * relative to the plans that matched. The top answer is the mildest the setting
 * offers and costs nothing; the bottom is the harshest and costs most.
 *
 * NOTHING TICKED MEANS NOTHING RECORDED — which for a restriction reads as
 * unqualified cover, and scores full marks. Restrictions only ever subtract, so
 * leaving a box alone can never quietly penalise a plan.
 */

/** What a settings box is called wherever one is shown. */
export const LIMITATIONS_LABEL = 'Any limitations';

/** What a benefit means when no restriction is ticked. */
export const NO_LIMITATIONS_LABEL = 'No limitations — covered in all cases';

/** How a ranked answer list describes itself while it is being edited. */
export const LIMITATION_RANK_LABEL = 'Ranked least restrictive first';

/** Shown on a setting whose answer list nobody has filled in yet. */
export const NO_LIMITATIONS_DEFINED_LABEL =
  'No answers defined for this setting yet. Add the ones its documents state.';

/**
 * The most cover the HARSHEST answer on a list may remove.
 *
 * A ceiling rather than a free hand, because the ranking says which condition
 * is harsher, never that any single one wipes the benefit out.
 */
export const LIMITATION_MAX_RESTRICTION = 0.6;

/**
 * The most that ticked restrictions may reduce a benefit's score, combined.
 *
 * Restricted cover is still cover. Without a floor, a benefit carrying four
 * qualifications could sink to nothing and rank level with a plan that does not
 * provide it at all — which is false, and would push the recommendation towards
 * plans that stay silent rather than plans that are honest about their
 * conditions. Silence must never outrank disclosure.
 */
export const LIMITATION_FLOOR = 0.35;

/** Most answers one setting may have ticked on one configuration. */
export const BENEFIT_LIMITATION_MAX = 8;

/** Longest an answer's wording may be. */
export const LIMITATION_NAME_MAX_LENGTH = 120;
