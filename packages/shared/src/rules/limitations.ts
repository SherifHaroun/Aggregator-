/**
 * How the limitations chosen on a benefit turn into a number the comparison
 * can use.
 *
 * Pure and database-free, like every rule here: the API supplies the weights it
 * read, this decides what they are worth, and both are testable apart.
 */

import {
  LIMITATION_FLOOR,
  LIMITATION_WEIGHT_MAX,
  LIMITATION_WEIGHT_MIN,
  NO_LIMITATIONS_LABEL,
} from '../config/limitations.js';

/** A limitation as it applies to one benefit on one configuration. */
export interface AppliedLimitation {
  id: string;
  name: string;
  /** Share of the benefit's cover this restriction removes, 0..1. */
  restrictionWeight: number;
}

/** Keep a stored weight inside the range the configuration allows. */
export function clampLimitationWeight(weight: number): number {
  if (!Number.isFinite(weight)) return LIMITATION_WEIGHT_MIN;
  return Math.min(LIMITATION_WEIGHT_MAX, Math.max(LIMITATION_WEIGHT_MIN, weight));
}

/**
 * What fraction of its cover a benefit keeps once its limitations are applied.
 *
 * Restrictions COMPOUND rather than add: cover locked to one network AND
 * limited to basic procedures keeps 70% of 75%, not 45%. Adding weights would
 * let three ordinary qualifications wipe a benefit out entirely, and would make
 * the result depend on how finely the catalogue happens to be split — two
 * limitations of 0.2 would outweigh one of 0.3 describing the same thing.
 *
 * Returns 1 when nothing is selected: no qualifications recorded means cover
 * with no qualifications, which is the best a benefit can be.
 */
export function limitationFactor(limitations: readonly AppliedLimitation[]): number {
  if (limitations.length === 0) return 1;

  const kept = limitations.reduce(
    (factor, limitation) => factor * (1 - clampLimitationWeight(limitation.restrictionWeight)),
    1,
  );

  // Restricted cover is still cover — never let it fall to nothing.
  return LIMITATION_FLOOR + (1 - LIMITATION_FLOOR) * kept;
}

/** How the limitations on a benefit read on screen. */
export function describeLimitations(limitations: readonly AppliedLimitation[]): string {
  if (limitations.length === 0) return NO_LIMITATIONS_LABEL;
  return limitations.map((limitation) => limitation.name).join(' · ');
}
