/**
 * Admin-specific wording.
 *
 * The reusable pieces — customer type / coverage labels, configuration titles
 * and money formatting — now live in `@aggregator/shared` so a future public
 * aggregator renders them identically. They are re-exported here so pages keep
 * one import site; `@aggregator/shared` is their canonical home.
 */

export {
  configurationLabel,
  coverageLabel,
  customerTypeLabel,
  formatMoney,
} from '@aggregator/shared';

/** "8 benefits" / "1 benefit" / "No benefits yet". Admin phrasing. */
export function benefitCountLabel(count: number): string {
  if (count === 0) return 'No benefits yet';
  return `${count} ${count === 1 ? 'benefit' : 'benefits'}`;
}
