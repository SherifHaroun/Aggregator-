/**
 * ============================================================================
 *  LIMITATIONS — THE QUALIFICATIONS ON A BENEFIT, MADE COMPARABLE
 * ============================================================================
 *
 * A plan document rarely states cover as a bare figure. It says "800 EGP for
 * BASIC PROCEDURES", "100% IN-NETWORK ONLY", "covered AT AUTHORIZED CENTERS",
 * "1 in 20 members ratio". Those qualifications decide what the cover is
 * actually worth, and until now they lived in a free-text note that the
 * comparison could not read — so two plans quoting 800 EGP scored identically
 * whether one paid for everything and the other only for fillings.
 *
 * A limitation is therefore a RECORD, chosen from a catalogue, not prose. This
 * file holds only the SYSTEM CONFIGURATION around them: which boxes offer
 * which list, how much a restriction is allowed to count, and how several of
 * them combine. The limitations themselves — their wording and their weight —
 * are insurance data and live in the database, where an employee can add to
 * them without a deploy.
 *
 * THE DEFAULT IS UNRESTRICTED. A benefit with nothing selected is cover with
 * no qualifications attached — "all procedures, all cases" — and scores full
 * marks. Restrictions only ever subtract, so leaving the box alone can never
 * quietly penalise a plan.
 */

import type { OptionFieldDataType } from './option-field-types.js';
import type { ConfigOption, OptionRegistry } from './option-registry.js';

/**
 * Which benefits a limitation is offered on.
 *
 * The two lists answer different questions and must not be mixed: a benefit
 * carrying a figure is qualified by what the figure buys ("basic procedures
 * only"), while a benefit carrying wording is qualified by the STATE of the
 * cover ("sliding scale", "not specified"). Offering both lists everywhere
 * would bury the four useful entries under twenty irrelevant ones.
 */
export const LIMITATION_SCOPE_IDS = ['VALUE', 'TEXT'] as const;

export type LimitationScope = (typeof LIMITATION_SCOPE_IDS)[number];

export interface LimitationScopeOption extends ConfigOption<LimitationScope> {}

export const LIMITATION_SCOPES: OptionRegistry<LimitationScope, LimitationScopeOption> = {
  VALUE: {
    id: 'VALUE',
    label: 'Amounts and percentages',
    description: 'Offered on a benefit quoted as a limit or a percentage.',
    order: 1,
    enabled: true,
  },
  TEXT: {
    id: 'TEXT',
    label: 'Wording',
    description: 'Offered on a benefit whose cover is described rather than counted.',
    order: 2,
    enabled: true,
  },
};

/**
 * Which list a benefit is offered, decided by the kind of value it carries.
 *
 * Declared per DATA TYPE, never per benefit name, so a benefit invented
 * tomorrow gets the right list without a code change — the same rule the
 * comparison direction follows.
 */
export function limitationScopeForDataType(
  dataType: OptionFieldDataType | null | undefined,
): LimitationScope {
  return dataType === 'TEXT' ? 'TEXT' : 'VALUE';
}

/** What the box is called wherever it is shown. */
export const LIMITATIONS_LABEL = 'Any limitations';

/**
 * What a benefit means when nothing is selected.
 *
 * Shown in the empty box and in the comparison, so an employee is never left
 * guessing whether blank means "unrestricted" or "nobody filled this in".
 */
export const NO_LIMITATIONS_LABEL = 'No limitations — covered in all cases';

/**
 * How restrictive a single limitation may be declared to be: the share of the
 * benefit's cover it takes away. 0 qualifies the cover without reducing it
 * ("in and out of network" is a statement of fact, not a restriction); 1 would
 * remove all of it.
 */
export const LIMITATION_WEIGHT_MIN = 0;
export const LIMITATION_WEIGHT_MAX = 1;

/**
 * The most that limitations may reduce a benefit's score, combined.
 *
 * Restricted cover is still cover. Without a floor, a benefit carrying four
 * qualifications could sink to nothing and rank level with a plan that does
 * not provide it at all — which is false, and would push the recommendation
 * towards plans that stay silent rather than plans that are honest about their
 * conditions. Silence must never outrank disclosure.
 */
export const LIMITATION_FLOOR = 0.35;

/** Most limitations one benefit may carry on one configuration. */
export const BENEFIT_LIMITATION_MAX = 8;

/** Longest a limitation's name may be. */
export const LIMITATION_NAME_MAX_LENGTH = 120;
