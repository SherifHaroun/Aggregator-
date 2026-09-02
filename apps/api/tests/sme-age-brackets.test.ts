/**
 * HOW AN SME IS PRICED, checked away from any screen.
 *
 * A business is a headcount per age group, not an age. These are the rules that
 * turn that headcount into a premium — and they are the same rules the
 * comparison screen draws its twelve boxes from, which is the point of them
 * living in one place.
 */

import {
  SME_AGE_BRACKETS,
  SME_COMPARISON_AVERAGE_AGE,
  SME_FIXED_AVERAGE_AGE,
  bandForSmeBracket,
  describeEmployeeCountProblem,
  describeSmeDistributionProblem,
  emptySmeEmployeeCounts,
  occupiedSmeBrackets,
  quoteSmeWorkforce,
  smeBracketForAge,
  totalSmeEmployees,
  type SmeEmployeeCounts,
  type SmePriceBand,
} from '@aggregator/shared';
import { describe, expect, it } from 'vitest';

/** A distribution, written the way a broker reads it off a staff list. */
const staff = (counts: Record<string, number>): SmeEmployeeCounts => ({
  ...emptySmeEmployeeCounts(),
  ...counts,
});

/** The twenty-employee business from the brief. */
const TWENTY = staff({
  '20–24': 2,
  '25–29': 4,
  '30–34': 6,
  '35–39': 5,
  '40–44': 2,
  '45–49': 1,
});

/** A rate table whose bands happen to line up with the brackets. */
const band = (ageFrom: number, ageTo: number, annualPrice: number | null): SmePriceBand => ({
  ageFrom,
  ageTo,
  annualPrice,
});

const GOLD: SmePriceBand[] = [
  band(20, 24, 3_100),
  band(25, 29, 3_960),
  band(30, 34, 4_290),
  band(35, 39, 5_130),
  band(40, 44, 5_890),
  band(45, 49, 8_490),
];

describe('the SME age brackets', () => {
  it('is twelve brackets, in order, ending open', () => {
    expect(SME_AGE_BRACKETS.map((bracket) => bracket.label)).toEqual([
      '0–17',
      '18–19',
      '20–24',
      '25–29',
      '30–34',
      '35–39',
      '40–44',
      '45–49',
      '50–54',
      '55–59',
      '60–64',
      '65+',
    ]);

    // Only the last is open-ended: a rate table stops splitting past retirement.
    expect(SME_AGE_BRACKETS.filter((bracket) => bracket.to === null)).toHaveLength(1);
    expect(SME_AGE_BRACKETS.at(-1)?.to).toBeNull();
  });

  it('is a partition: every age belongs to exactly one bracket', () => {
    for (let age = 0; age <= 120; age += 1) {
      const holding = SME_AGE_BRACKETS.filter(
        (bracket) => age >= bracket.from && (bracket.to === null || age <= bracket.to),
      );

      /**
       * No gap and no overlap. A gap is an employee nobody can be counted; an
       * overlap is a headcount that depends on which row was read first.
       */
      expect(holding).toHaveLength(1);
      expect(smeBracketForAge(age)).toEqual(holding[0]);
    }
  });

  it('puts each age in the bracket a broker would put it in', () => {
    expect(smeBracketForAge(0)?.label).toBe('0–17');
    expect(smeBracketForAge(17)?.label).toBe('0–17');
    expect(smeBracketForAge(18)?.label).toBe('18–19');
    expect(smeBracketForAge(24)?.label).toBe('20–24');
    expect(smeBracketForAge(25)?.label).toBe('25–29');
    expect(smeBracketForAge(34)?.label).toBe('30–34');
    expect(smeBracketForAge(64)?.label).toBe('60–64');
  });

  it('carries 65 and everyone older in the open bracket', () => {
    expect(smeBracketForAge(65)?.label).toBe('65+');
    expect(smeBracketForAge(80)?.label).toBe('65+');
    expect(smeBracketForAge(120)?.label).toBe('65+');

    // Past the oldest insurable age there is no bracket, rather than a wrong one.
    expect(smeBracketForAge(121)).toBeNull();
    expect(smeBracketForAge(-1)).toBeNull();
    expect(smeBracketForAge(35.5)).toBeNull();
  });
});

describe('counting a workforce', () => {
  it('adds the brackets up', () => {
    expect(totalSmeEmployees(TWENTY)).toBe(20);
    expect(totalSmeEmployees(emptySmeEmployeeCounts())).toBe(0);
  });

  it('counts a workforce that sits entirely in one bracket', () => {
    const counts = staff({ '30–34': 7 });
    expect(totalSmeEmployees(counts)).toBe(7);
    expect(occupiedSmeBrackets(counts)).toHaveLength(1);
  });

  it('reads an empty bracket as nobody, never as missing', () => {
    /**
     * Most brackets are empty in a small business. Zero is the employer saying
     * nobody is that age, and it is the commonest answer on the form.
     */
    expect(describeEmployeeCountProblem(0)).toBeNull();
    expect(describeSmeDistributionProblem(TWENTY)).toBeNull();
    expect(occupiedSmeBrackets(TWENTY).map((entry) => entry.bracket.label)).toEqual([
      '20–24',
      '25–29',
      '30–34',
      '35–39',
      '40–44',
      '45–49',
    ]);
  });

  it('refuses a headcount that is not a whole number of people', () => {
    expect(describeEmployeeCountProblem(3)).toBeNull();
    expect(describeEmployeeCountProblem(-1)).toMatch(/negative/i);
    expect(describeEmployeeCountProblem(2.5)).toMatch(/whole number/i);
    expect(describeEmployeeCountProblem(Number.NaN)).toMatch(/number of employees/i);
    expect(describeEmployeeCountProblem(Number.POSITIVE_INFINITY)).toMatch(/number of employees/i);
    expect(describeEmployeeCountProblem('4')).toMatch(/number of employees/i);
  });

  it('names the bracket the bad figure is in', () => {
    // Twelve boxes: "enter a whole number" without saying which is useless.
    expect(describeSmeDistributionProblem(staff({ '30–34': -2 }))).toBe(
      '30–34: A headcount cannot be negative.',
    );
    expect(describeSmeDistributionProblem(staff({ '65+': 1.5 }))).toBe(
      '65+: Enter a whole number of employees.',
    );
  });

  it('refuses a bracket that does not exist', () => {
    // Nothing may price against an age group the business never defined.
    expect(describeSmeDistributionProblem({ '18–35': 4 })).toMatch(/not an age bracket/i);
  });
});

describe('pricing a workforce against a plan', () => {
  it('multiplies each bracket by what the plan charges at that age', () => {
    const quote = quoteSmeWorkforce(TWENTY, GOLD);

    // 2×3,100 + 4×3,960 + 6×4,290 + 5×5,130 + 2×5,890 + 1×8,490
    expect(quote.total).toBe(
      2 * 3_100 + 4 * 3_960 + 6 * 4_290 + 5 * 5_130 + 2 * 5_890 + 1 * 8_490,
    );
    expect(quote.total).toBe(93_700);
    expect(quote.employeeCount).toBe(20);
  });

  it('shows its working, one line per occupied bracket', () => {
    const quote = quoteSmeWorkforce(TWENTY, GOLD);

    expect(quote.lines).toHaveLength(6);
    expect(quote.lines[0]).toMatchObject({
      bracketId: '20–24',
      count: 2,
      unitPrice: 3_100,
      subtotal: 6_200,
    });
    expect(quote.lines.at(-1)).toMatchObject({ bracketId: '45–49', count: 1, subtotal: 8_490 });
  });

  it('charges nothing for a bracket holding nobody', () => {
    const withEmpties = quoteSmeWorkforce(TWENTY, [
      ...GOLD,
      // The plan sells at these ages; this business has nobody there.
      band(0, 17, 99_999),
      band(60, 64, 99_999),
    ]);

    /**
     * An empty bracket is not an exclusion and not a price — the employer has
     * nobody there, so the plan is simply never asked.
     */
    expect(withEmpties.total).toBe(93_700);
    expect(withEmpties.lines.map((line) => line.bracketId)).not.toContain('0–17');
  });

  it('gives two plans two different prices for the same workforce', () => {
    const silver: SmePriceBand[] = GOLD.map((row) => ({
      ...row,
      annualPrice: row.annualPrice! / 2,
    }));

    const gold = quoteSmeWorkforce(TWENTY, GOLD);
    const cheap = quoteSmeWorkforce(TWENTY, silver);

    // Same staff list, priced independently against each plan's own table.
    expect(cheap.total).toBe(46_850);
    expect(gold.total).toBe(93_700);
    expect(cheap.employeeCount).toBe(gold.employeeCount);
  });

  it('prices a bracket on the band covering most of it', () => {
    /**
     * A plan's own bands are whatever its rate table says and need not line up
     * with these twelve. 30–34 is mostly inside 28–32, so that is where most of
     * those employees sit.
     */
    const bands = [band(28, 32, 1_000), band(33, 40, 9_000)];
    const bracket = SME_AGE_BRACKETS.find((entry) => entry.label === '30–34')!;

    expect(bandForSmeBracket(bracket, bands)?.annualPrice).toBe(1_000);
    expect(quoteSmeWorkforce(staff({ '30–34': 3 }), bands).total).toBe(3_000);
  });

  it('will not quote a workforce it cannot price in full', () => {
    // The plan sells nothing to anyone over 44; two employees are 45–49.
    const partial = quoteSmeWorkforce(TWENTY, GOLD.slice(0, 5));

    /**
     * A total missing one bracket would undercut every plan that priced the
     * lot — the cheapest quote on the screen for the least cover.
     */
    expect(partial.total).toBeNull();
    expect(partial.unpricedBracketIds).toEqual(['45–49']);
  });

  it('treats a band with no premium as not sold at that age', () => {
    const bands = [band(20, 24, 3_100), band(25, 29, null)];

    // The legacy tables said "not sold here" by leaving the cell empty.
    expect(quoteSmeWorkforce(staff({ '25–29': 1 }), bands).total).toBeNull();
    expect(quoteSmeWorkforce(staff({ '20–24': 1 }), bands).total).toBe(3_100);
  });

  it('will not quote a workforce of nobody', () => {
    /**
     * Zero employees priced at 0 would make every plan free and tie them all at
     * the top, which is a comparison of nothing.
     */
    expect(quoteSmeWorkforce(emptySmeEmployeeCounts(), GOLD).total).toBeNull();
  });
});

describe('the hidden comparison age', () => {
  it('is 35, and is the business rule the rest of the system already had', () => {
    expect(SME_COMPARISON_AVERAGE_AGE).toBe(35);
    // One constant, not a second copy that could drift from the first.
    expect(SME_COMPARISON_AVERAGE_AGE).toBe(SME_FIXED_AVERAGE_AGE);
  });

  it('is never derived from the workforce entered', () => {
    /**
     * This staff list averages well over 35. The comparison age does not move,
     * because it is an assumption about how SME cover is quoted rather than a
     * measurement of anybody's employees.
     */
    const older = staff({ '55–59': 10, '60–64': 10 });
    expect(totalSmeEmployees(older)).toBe(20);
    expect(SME_COMPARISON_AVERAGE_AGE).toBe(35);

    const younger = staff({ '18–19': 20 });
    expect(totalSmeEmployees(younger)).toBe(20);
    expect(SME_COMPARISON_AVERAGE_AGE).toBe(35);
  });
});

/**
 * THE BUDGET A BUSINESS IS OFFERED.
 *
 * The screen proposes a budget from what the matching plans cost, so that
 * figure and the prices shown afterwards have to be the same arithmetic. For a
 * business that means the whole workforce — a budget worked out from one
 * person at the standard age is a fraction of the bill, and proposing it put
 * every plan over the ceiling and produced "no matching plans" for a workforce
 * every one of them could have quoted.
 */
describe('the budget proposed to a business', () => {
  const RATE: SmePriceBand[] = [
    band(0, 17, 2_905),
    band(18, 18, 2_949),
    band(19, 24, 3_138),
    band(25, 29, 3_960),
    band(30, 34, 4_296),
    band(35, 39, 5_134),
    band(40, 44, 5_893),
    band(45, 49, 8_491),
  ];

  it('is what the workforce costs, not what one employee costs', () => {
    const workforce = staff({ '20–24': 10 });
    const quote = quoteSmeWorkforce(workforce, RATE);

    // Ten employees at 3,138 each.
    expect(quote.total).toBe(31_380);

    /**
     * The band spanning the standard comparison age is 5,134 — one person's
     * premium. A budget of 5,134 against a bill of 31,380 excludes the very
     * plan it was derived from.
     */
    const oneHeadAtTheStandardAge = RATE.find(
      (row) => row.ageFrom <= SME_COMPARISON_AVERAGE_AGE && row.ageTo >= SME_COMPARISON_AVERAGE_AGE,
    )!.annualPrice;
    expect(oneHeadAtTheStandardAge).toBe(5_134);
    expect(quote.total).toBeGreaterThan(oneHeadAtTheStandardAge!);
  });

  it('leaves out a plan that cannot quote the workforce at all', () => {
    /**
     * This rate table stops at 49. A workforce with somebody older has no
     * price on this plan, and a floor it could never actually offer is worse
     * than no floor at all.
     */
    expect(quoteSmeWorkforce(staff({ '50–54': 1 }), RATE).total).toBeNull();
    expect(quoteSmeWorkforce(staff({ '20–24': 10, '50–54': 1 }), RATE).total).toBeNull();
  });
});
