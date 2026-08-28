/**
 * Turning a place in an ordered list into something the comparison can rank.
 *
 * A ranked benefit is cover that is neither a figure nor free wording — a
 * named tier. "Golden Care Network" is not 80%, but it is plainly better than
 * "Orange Care Network", and the employee is the one who knows that. They say
 * it once by putting the list in order; this converts that order into a number
 * so every plan quoting a tier is ranked by it.
 */

/** One answer a ranked benefit offers, as the engine needs to see it. */
export interface RankedChoice {
  id: string;
  label: string;
  /** Position in the list. 0 is best. */
  sortOrder: number;
}

/**
 * What a chosen answer is worth, as a number where MORE IS BETTER.
 *
 * The list is inverted so the entry the employee put first scores highest, and
 * the bottom entry still scores 1 rather than 0 — being the worst network on
 * offer is not the same as having no network at all, and 0 is reserved for
 * cover a plan does not provide.
 *
 * `null` when the answer is not in the list: an entry that was deleted, or a
 * value recorded before the benefit was ranked. Unrankable rather than worst,
 * because the two are different and only one of them is the plan's fault.
 */
export function rankValue(choiceId: string | null, choices: readonly RankedChoice[]): number | null {
  if (choiceId === null) return null;

  const ordered = [...choices].sort((a, b) => a.sortOrder - b.sortOrder);
  const position = ordered.findIndex((choice) => choice.id === choiceId);
  if (position === -1) return null;

  return ordered.length - position;
}

/** The wording of a chosen answer, or `null` when it is no longer on the list. */
export function rankLabel(choiceId: string | null, choices: readonly RankedChoice[]): string | null {
  if (choiceId === null) return null;
  return choices.find((choice) => choice.id === choiceId)?.label ?? null;
}
