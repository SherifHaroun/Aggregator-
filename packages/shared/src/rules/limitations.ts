/**
 * How the answers ticked on a benefit's settings turn into a number the
 * comparison can use.
 *
 * Pure and database-free, like every rule here: the API supplies the ranking it
 * read, this decides what it is worth, and both are testable apart.
 */

import {
  LIMITATION_FLOOR,
  LIMITATION_MAX_RESTRICTION,
  NO_LIMITATIONS_LABEL,
} from '../config/limitations.js';

/** One ticked answer, as it applies to a benefit on one configuration. */
export interface AppliedLimitation {
  id: string;
  name: string;
  /** Position in its own setting's ranked list. 0 is the mildest. */
  rank: number;
  /** How many answers that setting offers in total. */
  rankCount: number;
}

/**
 * What share of a benefit's cover ONE ticked answer removes, from where it sits
 * in its setting's list.
 *
 * Relative to that list and nothing else. The top answer costs NOTHING: it is
 * the mildest the setting offers, and a plan carrying only it is carrying the
 * best case on the list. The bottom costs the most the ceiling allows, and
 * everything between is spaced evenly — so dragging one answer above another is
 * a complete judgement, with no number typed anywhere.
 *
 * A list of one discriminates between nothing, so it costs nothing rather than
 * an arbitrary amount.
 */
export function limitationWeight(rank: number, rankCount: number): number {
  if (rankCount <= 1) return 0;
  const position = Math.min(Math.max(rank, 0), rankCount - 1);
  return (position / (rankCount - 1)) * LIMITATION_MAX_RESTRICTION;
}

/**
 * What fraction of its cover a benefit keeps once its restrictions are applied.
 *
 * Restrictions COMPOUND rather than add: cover locked to one network AND
 * limited to basic procedures keeps 70% of 75%, not 45%. Adding weights would
 * let three ordinary qualifications wipe a benefit out, and would make the
 * result depend on how finely a list happens to be split — two mild answers
 * would outweigh one harsh one describing the same thing.
 *
 * Returns 1 when nothing is ticked: no qualification recorded means cover with
 * no qualifications, which is the best a benefit can be.
 */
export function limitationFactor(limitations: readonly AppliedLimitation[]): number {
  if (limitations.length === 0) return 1;

  const kept = limitations.reduce(
    (factor, limitation) => factor * (1 - limitationWeight(limitation.rank, limitation.rankCount)),
    1,
  );

  // Restricted cover is still cover — never let it fall to nothing.
  return LIMITATION_FLOOR + (1 - LIMITATION_FLOOR) * kept;
}

/** How the restrictions on a benefit read on screen. */
export function describeLimitations(limitations: readonly AppliedLimitation[]): string {
  if (limitations.length === 0) return NO_LIMITATIONS_LABEL;
  return limitations.map((limitation) => limitation.name).join(' · ');
}
