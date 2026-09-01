/**
 * Employee age brackets stay a partition.
 *
 * A pure rule, so no database: what matters is that moving one boundary moves
 * its neighbour, that each premium stays with its own bracket, and that a gap
 * is refused for an SME and allowed for everybody else.
 */

import {
  describeBracketProblem,
  nextBracket,
  rebalanceBrackets,
  removeBracket,
} from '@aggregator/shared';
import { describe, expect, it } from 'vitest';

/** The table from the legacy SME data, with its premiums. */
const table = () => [
  { ageFrom: 21, ageTo: 25, premium: 3681 },
  { ageFrom: 26, ageTo: 30, premium: 5701 },
  { ageFrom: 31, ageTo: 35, premium: 7132 },
];

const shape = (rows: { ageFrom: number; ageTo: number; premium?: number }[]) =>
  rows.map((row) => `${row.ageFrom}-${row.ageTo}:${row.premium ?? ''}`);

describe('an edited boundary moves its neighbour', () => {
  it('pushes the next bracket forward when one is widened', () => {
    const rows = table();
    rows[0]!.ageTo = 27;

    // 21-25 became 21-27, so the next starts at 28 — nobody edits it by hand.
    expect(shape(rebalanceBrackets(rows, 0))).toEqual([
      '21-27:3681',
      '28-30:5701',
      '31-35:7132',
    ]);
  });

  it('pulls the previous bracket back when one is started later', () => {
    const rows = table();
    rows[1]!.ageFrom = 28;

    expect(shape(rebalanceBrackets(rows, 1))).toEqual([
      '21-27:3681',
      '28-30:5701',
      '31-35:7132',
    ]);
  });

  it('keeps each premium with its own bracket', () => {
    const rows = table();
    rows[0]!.ageTo = 27;
    const rebalanced = rebalanceBrackets(rows, 0);

    // The row was RE-BOUNDED, not replaced: 3681 is still the youngest band's.
    expect(rebalanced[0]?.premium).toBe(3681);
    expect(rebalanced[1]?.premium).toBe(5701);
    expect(rebalanced[2]?.premium).toBe(7132);
  });

  it('collapses rather than inverting when a bracket is squeezed past itself', () => {
    const rows = table();
    // Widening the first past the second leaves the second no room at all.
    rows[0]!.ageTo = 30;
    const rebalanced = rebalanceBrackets(rows, 0);

    expect(rebalanced[1]?.ageFrom).toBe(31);
    expect(rebalanced[1]?.ageTo).toBeGreaterThanOrEqual(rebalanced[1]!.ageFrom);
    expect(describeBracketProblem(rebalanced)).toBeNull();
  });

  it('leaves a table of one alone', () => {
    const rows = [{ ageFrom: 21, ageTo: 25, premium: 100 }];
    expect(shape(rebalanceBrackets(rows, 0))).toEqual(['21-25:100']);
  });
});

describe('adding and removing a bracket', () => {
  it('continues from where the last one ended', () => {
    expect(nextBracket(table())).toEqual({ ageFrom: 36, ageTo: 40 });
  });

  it('closes the hole a removed bracket leaves', () => {
    // 26-30 goes; 31-35 takes over its years so no age is left unpriced.
    expect(shape(removeBracket(table(), 1))).toEqual(['21-25:3681', '26-35:7132']);
    expect(describeBracketProblem(removeBracket(table(), 1))).toBeNull();
  });

  it('simply shortens the table when the last one goes', () => {
    expect(shape(removeBracket(table(), 2))).toEqual(['21-25:3681', '26-30:5701']);
  });
});

describe('what a table of brackets may not be', () => {
  it('refuses an overlap', () => {
    expect(
      describeBracketProblem([
        { ageFrom: 1, ageTo: 17 },
        { ageFrom: 10, ageTo: 25 },
      ]),
    ).toMatch(/overlap/i);
  });

  it('refuses a backwards range', () => {
    expect(describeBracketProblem([{ ageFrom: 40, ageTo: 30 }])).toMatch(/backwards/i);
  });

  it('refuses a gap for an SME, and allows one for everybody else', () => {
    const gapped = [
      { ageFrom: 21, ageTo: 25 },
      { ageFrom: 30, ageTo: 35 },
    ];

    // Employees fall between 26 and 29, and nobody priced them.
    expect(describeBracketProblem(gapped)).toMatch(/Nothing is priced between 26 and 29/);

    /**
     * An individual or family plan may simply not be sold at those ages, and
     * the absence of a band is how the document says so.
     */
    expect(describeBracketProblem(gapped, { requireContiguous: false })).toBeNull();
  });

  it('accepts the table it started from', () => {
    expect(describeBracketProblem(table())).toBeNull();
  });
});
