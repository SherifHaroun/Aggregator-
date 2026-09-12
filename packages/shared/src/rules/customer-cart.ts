/**
 * HOW A COMPARISON IN A CUSTOMER'S CART IS NAMED.
 *
 * "Arope SME 1", then "Arope SME 2": the company, the section the plan is
 * sold in, and how many of that pairing the customer already has. The
 * employee never types it — a cart with the same insurer three times over
 * needs the numbers to tell the entries apart, and typing them is how they
 * end up wrong.
 *
 * The count is per company AND section, not per cart: a customer weighing
 * Arope against AXA has "Arope SME 1" and "AXA SME 1", which reads as what it
 * is, rather than "AXA SME 2".
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import { customerTypeLabel } from './insurance-labels.js';

/** What an existing cart item contributes to the count. */
export interface CartNamePeer {
  companyId: string | null;
  customerTypeId: CustomerTypeId;
  /** The number this item was given, e.g. 2 in "Arope SME 2". */
  nameSequence: number;
}

/**
 * The next number for this company and section: one more than the highest
 * already given, never a gap filled. Removing "Arope SME 1" and adding
 * another Arope comparison gives "Arope SME 3", so an entry in the
 * customer's notes still names the one it meant.
 */
export function nextCartNameSequence(
  peers: readonly CartNamePeer[],
  companyId: string | null,
  customerTypeId: CustomerTypeId,
): number {
  const highest = peers
    .filter((peer) => peer.companyId === companyId && peer.customerTypeId === customerTypeId)
    .reduce((max, peer) => Math.max(max, peer.nameSequence), 0);
  return highest + 1;
}

/** "Arope SME 2" — spelled the one way, everywhere. */
export function cartItemName(
  companyName: string,
  customerTypeId: CustomerTypeId,
  sequence: number,
): string {
  return `${companyName} ${customerTypeLabel(customerTypeId)} ${sequence}`;
}
