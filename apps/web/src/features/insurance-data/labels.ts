/**
 * Admin-specific wording.
 *
 * The reusable pieces — customer type / coverage labels, configuration titles
 * and money formatting — now live in `@aggregator/shared` so a future public
 * aggregator renders them identically. They are re-exported here so pages keep
 * one import site; `@aggregator/shared` is their canonical home.
 */

import { formatMoney } from '@aggregator/shared';

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

/** How many age bands a variant is priced across. */
export function bandCountLabel(count: number): string {
  if (count === 0) return 'Not priced yet';
  return `${count} ${count === 1 ? 'age band' : 'age bands'}`;
}

/**
 * What a variant costs across its whole rate table.
 *
 * One figure when a single band is priced, a range when the premium climbs with
 * age — which is what an insurer's own table shows. Bands with no premium are
 * ignored: they say the plan is not sold at that age, not that it is free.
 */
export function priceRangeLabel(variant: {
  priceBands: { annualPrice: number | null }[];
  currency: string | null;
}): string {
  const prices = variant.priceBands
    .map((band) => band.annualPrice)
    .filter((price): price is number => price !== null);
  if (prices.length === 0) return formatMoney(null, variant.currency);

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high
    ? formatMoney(low, variant.currency)
    : `${formatMoney(low, variant.currency)} – ${formatMoney(high, variant.currency)}`;
}
