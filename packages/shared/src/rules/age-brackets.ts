/**
 * AGE BRACKETS THAT STAY CONTINUOUS.
 *
 * An SME is priced by employee age band, and those bands are a partition: every
 * age between the first and the last falls into exactly one of them. A gap
 * means an employee nobody priced; an overlap means a premium that depends on
 * which row was read first. Neither is a thing an insurer's table ever says.
 *
 * So editing one boundary MOVES ITS NEIGHBOUR rather than inviting the employee
 * to fix nine more rows by hand. Changing 21-25 to 21-27 makes the next band
 * start at 28; pulling 26-30 back to 28-30 pushes the one before it to end at
 * 27. The premium stays with its own band throughout — the row is being
 * re-bounded, not replaced.
 *
 * Individual and Family plans do NOT use this. One person has one age, and a
 * family is a list of people rather than a partition of the number line.
 */

export interface AgeBracket {
  ageFrom: number;
  ageTo: number;
}

/**
 * Re-bound a list of brackets around the one that was just edited.
 *
 * The edited bracket is the ANCHOR and keeps exactly what was typed. Everything
 * after it is pushed to start where its predecessor ends; everything before it
 * is pulled to end where its successor begins. A bracket squeezed past itself
 * collapses to a single year rather than inverting, because a backwards range
 * is not a range at all.
 *
 * Order is preserved: the list is treated as already reading youngest first,
 * which is how a rate table is written and how the editor lists it.
 */
export function rebalanceBrackets<T extends AgeBracket>(brackets: T[], anchorIndex: number): T[] {
  if (brackets.length === 0) return brackets;

  const next = brackets.map((bracket) => ({ ...bracket }));
  const anchor = next[anchorIndex];
  if (!anchor) return next;

  // The anchor itself may have been typed backwards; a single year is the
  // nearest thing to what was meant.
  if (anchor.ageFrom > anchor.ageTo) anchor.ageTo = anchor.ageFrom;

  // Forward: each bracket starts the year after the one before it.
  for (let index = anchorIndex + 1; index < next.length; index += 1) {
    const previous = next[index - 1]!;
    const current = next[index]!;
    current.ageFrom = previous.ageTo + 1;
    if (current.ageTo < current.ageFrom) current.ageTo = current.ageFrom;
  }

  // Backward: each bracket ends the year before the one after it.
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    const following = next[index + 1]!;
    const current = next[index]!;
    current.ageTo = following.ageFrom - 1;
    if (current.ageFrom > current.ageTo) current.ageFrom = current.ageTo;
  }

  return next;
}

/**
 * The bracket to append, continuing from the last one.
 *
 * Five years is the span the legacy tables used most often, and it is a
 * starting point the employee edits rather than a rule.
 */
export function nextBracket(brackets: AgeBracket[], span = 5): AgeBracket {
  const last = brackets[brackets.length - 1];
  const ageFrom = last ? last.ageTo + 1 : 0;
  return { ageFrom, ageTo: ageFrom + span - 1 };
}

/**
 * Close the hole a removed bracket leaves.
 *
 * The bracket that followed it takes over the years it covered, so the table
 * stays a partition. Removing the LAST one simply shortens the table — there is
 * nothing after it to extend, and a plan is allowed to stop being sold at an
 * age.
 */
export function removeBracket<T extends AgeBracket>(brackets: T[], index: number): T[] {
  const removed = brackets[index];
  if (!removed) return brackets;

  const next = brackets.filter((_, position) => position !== index).map((b) => ({ ...b }));
  const successor = next[index];
  if (successor) successor.ageFrom = removed.ageFrom;
  return next;
}

/**
 * What is wrong with a table of brackets, or `null` when nothing is.
 *
 * `requireContiguous` is what separates an SME's employee brackets from an
 * ordinary rate table. Brackets price a workforce, so an unpriced age between
 * the first and the last is an employee nobody can be quoted for. Elsewhere a
 * plan may simply not be sold at an age, and the absence of a band says so.
 */
export function describeBracketProblem(
  brackets: AgeBracket[],
  { requireContiguous = true }: { requireContiguous?: boolean } = {},
): string | null {
  const ordered = [...brackets].sort((a, b) => a.ageFrom - b.ageFrom || a.ageTo - b.ageTo);

  for (const bracket of ordered) {
    if (bracket.ageFrom > bracket.ageTo) {
      return `Ages ${bracket.ageFrom}–${bracket.ageTo} run backwards.`;
    }
  }

  for (const [index, bracket] of ordered.entries()) {
    const previous = ordered[index - 1];
    if (!previous) continue;
    if (bracket.ageFrom <= previous.ageTo) {
      return `Ages ${previous.ageFrom}–${previous.ageTo} and ${bracket.ageFrom}–${bracket.ageTo} overlap. Every age must fall into exactly one band.`;
    }
    if (requireContiguous && bracket.ageFrom > previous.ageTo + 1) {
      return `Nothing is priced between ${previous.ageTo + 1} and ${bracket.ageFrom - 1}. Employee bands must run without gaps.`;
    }
  }

  return null;
}

/** Whether the brackets form an unbroken run, youngest to eldest. */
export function bracketsAreContiguous(brackets: AgeBracket[]): boolean {
  return describeBracketProblem(brackets) === null;
}
