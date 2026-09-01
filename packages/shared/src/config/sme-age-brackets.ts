/**
 * THE AGE BRACKETS AN SME IS PRICED BY.
 *
 * A business does not have "an age" — it has a workforce. Asking a broker to
 * type an age per employee is asking for the one thing they do not have to
 * hand; what they do have is a headcount per age group, because that is how
 * every insurer's SME rate table is written.
 *
 * This file is the ONLY place the brackets are defined. The comparison screen,
 * the pricing calculation and the tests all read them from here — a second copy
 * would let a bracket that exists on screen disagree with the one being priced.
 *
 * To change, add or retire a bracket, edit `SME_AGE_BRACKETS` and nothing else.
 */

import {
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  SME_FIXED_AVERAGE_AGE,
} from './business-rules.js';

/**
 * The age every SME comparison is reasoned about, whatever its workforce.
 *
 * HIDDEN FROM THE EMPLOYEE ON PURPOSE. It is a business assumption about how
 * SME cover is quoted, not a preference, and it is NEVER derived from the
 * headcounts entered below — an employer whose staff average 48 is still
 * compared on the standard the business set.
 *
 * The headcounts price the workforce; this ages it.
 */
export const SME_COMPARISON_AVERAGE_AGE = SME_FIXED_AVERAGE_AGE;

/**
 * A bracket's identity is its own bounds, so nothing has to be kept in step.
 * `to: null` is the open-ended top bracket — "65 and over", which every rate
 * table ends with because insurers stop splitting past retirement age.
 */
export interface SmeAgeBracket {
  id: string;
  from: number;
  /** `null` for the open-ended top bracket. */
  to: number | null;
  label: string;
}

/** The bracket bounds, lowest first. The last one is open-ended. */
const BRACKET_BOUNDS: readonly (readonly [number, number | null])[] = [
  [0, 17],
  [18, 19],
  [20, 24],
  [25, 29],
  [30, 34],
  [35, 39],
  [40, 44],
  [45, 49],
  [50, 54],
  [55, 59],
  [60, 64],
  [65, null],
];

/** How a bracket reads on screen, derived from its bounds rather than typed. */
export function smeBracketLabel(from: number, to: number | null): string {
  return to === null ? `${from}+` : `${from}–${to}`;
}

/**
 * Every bracket, lowest first. A PARTITION of the insurable ages: they leave no
 * gap and never overlap, so every age belongs to exactly one — which is what
 * makes "how many employees are in each" a question with one right answer.
 */
export const SME_AGE_BRACKETS: readonly SmeAgeBracket[] = BRACKET_BOUNDS.map(([from, to]) => ({
  id: smeBracketLabel(from, to),
  from,
  to,
  label: smeBracketLabel(from, to),
}));

/** The youngest and eldest ages the brackets cover, read off the brackets. */
export const SME_BRACKET_MIN_AGE = SME_AGE_BRACKETS[0]!.from;
export const SME_BRACKET_MAX_AGE = MAX_INSURABLE_AGE;

/** How many employees are in each bracket, keyed by bracket id. */
export type SmeEmployeeCounts = Readonly<Record<string, number>>;

/** Every bracket at zero — what the screen opens with. */
export function emptySmeEmployeeCounts(): SmeEmployeeCounts {
  return Object.fromEntries(SME_AGE_BRACKETS.map((bracket) => [bracket.id, 0]));
}

/** Whether an id names a bracket that exists. */
export function isSmeAgeBracketId(id: string): boolean {
  return SME_AGE_BRACKETS.some((bracket) => bracket.id === id);
}

/**
 * The bracket an age falls in, or `null` for an age nobody can be insured at.
 *
 * The top bracket is open-ended, so every age from 65 to the oldest insurable
 * lands in it rather than falling off the end of the table.
 */
export function smeBracketForAge(age: number): SmeAgeBracket | null {
  if (!Number.isInteger(age)) return null;
  if (age < MIN_INSURABLE_AGE || age > MAX_INSURABLE_AGE) return null;
  return (
    SME_AGE_BRACKETS.find((bracket) => age >= bracket.from && (bracket.to === null || age <= bracket.to)) ??
    null
  );
}

/**
 * What is wrong with a headcount, or `null` when it is a real one.
 *
 * Zero is a legitimate answer and the commonest one — most brackets are empty
 * in a small business, and an empty bracket is the employer saying nobody is
 * that age. A fraction of an employee is not an answer at all.
 */
export function describeEmployeeCountProblem(count: unknown): string | null {
  if (typeof count !== 'number' || Number.isNaN(count)) return 'Enter a number of employees.';
  if (!Number.isFinite(count)) return 'Enter a number of employees.';
  if (!Number.isInteger(count)) return 'Enter a whole number of employees.';
  if (count < 0) return 'A headcount cannot be negative.';
  return null;
}

/**
 * What is wrong with a whole distribution, or `null` when it is a real one.
 *
 * Named by bracket, because "Enter a whole number" is useless on a form with
 * twelve boxes.
 */
export function describeSmeDistributionProblem(counts: SmeEmployeeCounts): string | null {
  for (const id of Object.keys(counts)) {
    if (!isSmeAgeBracketId(id)) return `“${id}” is not an age bracket.`;
  }
  for (const bracket of SME_AGE_BRACKETS) {
    const problem = describeEmployeeCountProblem(counts[bracket.id] ?? 0);
    if (problem) return `${bracket.label}: ${problem}`;
  }
  return null;
}

/** How many employees the distribution describes in total. */
export function totalSmeEmployees(counts: SmeEmployeeCounts): number {
  return SME_AGE_BRACKETS.reduce((sum, bracket) => sum + (counts[bracket.id] ?? 0), 0);
}

/** The brackets that actually hold somebody — the only ones worth pricing. */
export function occupiedSmeBrackets(
  counts: SmeEmployeeCounts,
): { bracket: SmeAgeBracket; count: number }[] {
  return SME_AGE_BRACKETS.map((bracket) => ({ bracket, count: counts[bracket.id] ?? 0 })).filter(
    (entry) => entry.count > 0,
  );
}

/** A plan's price for one age band, as the variant records it. */
export interface SmePriceBand {
  ageFrom: number;
  ageTo: number;
  annualPrice: number | null;
}

export interface SmeQuote {
  /** The premium for the whole workforce, or `null` if it cannot be priced. */
  total: number | null;
  employeeCount: number;
  /** What each occupied bracket contributed, in bracket order. */
  lines: {
    bracketId: string;
    label: string;
    count: number;
    /** The plan's price for one employee in this bracket. */
    unitPrice: number | null;
    subtotal: number | null;
  }[];
  /** Brackets holding employees this plan does not price. */
  unpricedBracketIds: string[];
}

/**
 * The band that prices a bracket: the one covering most of it.
 *
 * A plan's own bands are whatever its rate table says — 21–27, 28–35 — and
 * they need not line up with these twelve. Where a bracket straddles two, the
 * band holding most of its years is the one most of its employees fall in, and
 * the tie goes to the lower band because that is the one their ages start in.
 *
 * A band with no premium prices nothing: an insurer leaving the cell empty is
 * saying it does not sell at that age, which is an exclusion rather than a
 * gift.
 */
export function bandForSmeBracket(
  bracket: SmeAgeBracket,
  bands: readonly SmePriceBand[],
): SmePriceBand | null {
  const to = bracket.to ?? SME_BRACKET_MAX_AGE;
  let best: { band: SmePriceBand; overlap: number } | null = null;

  for (const band of bands) {
    if (band.annualPrice === null) continue;
    const overlap = Math.min(band.ageTo, to) - Math.max(band.ageFrom, bracket.from) + 1;
    if (overlap <= 0) continue;
    if (best === null || overlap > best.overlap) best = { band, overlap };
  }

  return best?.band ?? null;
}

/**
 * WHAT THE WORKFORCE COSTS ON THIS PLAN.
 *
 * Each bracket's headcount times what the plan charges at that age, added up.
 * Empty brackets contribute nothing — not a price, not an exclusion; the
 * employer simply has nobody there and the plan is not asked about it.
 *
 * A plan that cannot price a bracket somebody is IN cannot quote this
 * workforce at all, so the total is `null` rather than a sum with a hole in it.
 * A figure missing one bracket would undercut every plan that priced the lot.
 */
export function quoteSmeWorkforce(
  counts: SmeEmployeeCounts,
  bands: readonly SmePriceBand[],
): SmeQuote {
  const lines = occupiedSmeBrackets(counts).map(({ bracket, count }) => {
    const band = bandForSmeBracket(bracket, bands);
    const unitPrice = band?.annualPrice ?? null;
    return {
      bracketId: bracket.id,
      label: bracket.label,
      count,
      unitPrice,
      subtotal: unitPrice === null ? null : unitPrice * count,
    };
  });

  const unpricedBracketIds = lines
    .filter((line) => line.subtotal === null)
    .map((line) => line.bracketId);

  const employeeCount = totalSmeEmployees(counts);

  return {
    /**
     * A workforce of nobody has no premium. Reading it as 0 would make every
     * plan free and tie them all at the top, which is a comparison of nothing.
     */
    total:
      employeeCount === 0 || unpricedBracketIds.length > 0
        ? null
        : lines.reduce((sum, line) => sum + line.subtotal!, 0),
    employeeCount,
    lines,
    unpricedBracketIds,
  };
}
