/**
 * HOW A COMPARISON IN A CUSTOMER'S CART IS NAMED.
 *
 * "Arope SME 1", "Arope SME 2": company, section, count of that pairing in
 * this cart. Pure rules from the shared package, so they run without a
 * database and the API and the screens can never disagree on a name.
 */

import { cartItemName, nextCartNameSequence, type CartNamePeer } from '@aggregator/shared';
import { describe, expect, it } from 'vitest';

describe('naming a comparison in the cart', () => {
  it('spells the name as company, section and number', () => {
    expect(cartItemName('Arope', 'SME', 1)).toBe('Arope SME 1');
    expect(cartItemName('AXA', 'INDIVIDUAL', 3)).toBe('AXA Individual 3');
    expect(cartItemName('MetLife', 'FAMILY', 2)).toBe('MetLife Family 2');
  });

  it('starts at 1 for a company and section the cart has not seen', () => {
    expect(nextCartNameSequence([], 'arope', 'SME')).toBe(1);
  });

  it('counts per company AND section, so AXA does not inherit Arope’s number', () => {
    const peers: CartNamePeer[] = [
      { companyId: 'arope', customerTypeId: 'SME', nameSequence: 1 },
      { companyId: 'arope', customerTypeId: 'SME', nameSequence: 2 },
      { companyId: 'arope', customerTypeId: 'INDIVIDUAL', nameSequence: 1 },
    ];
    expect(nextCartNameSequence(peers, 'arope', 'SME')).toBe(3);
    expect(nextCartNameSequence(peers, 'arope', 'INDIVIDUAL')).toBe(2);
    expect(nextCartNameSequence(peers, 'axa', 'SME')).toBe(1);
  });

  it('continues from the highest number given, never filling a gap', () => {
    // "Arope SME 1" was removed; the next Arope comparison is 3, so a note
    // that said "the second one" still means the one it meant.
    const peers: CartNamePeer[] = [{ companyId: 'arope', customerTypeId: 'SME', nameSequence: 2 }];
    expect(nextCartNameSequence(peers, 'arope', 'SME')).toBe(3);
  });
});
