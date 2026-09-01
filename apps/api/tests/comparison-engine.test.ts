/**
 * The comparison engine's judgement, checked against the situations the
 * business cares about.
 *
 * Every plan, price and percentage below is invented inside the test. The
 * engine never sees a company, benefit or plan the code knows by name — which
 * is the point: the same rules have to hold for whatever is in the database.
 */

import {
  explainRecommendation,
  rankLabel,
  rankValue,
  scoreCandidates,
  NOT_COVERED_LABEL,
  NOT_SPECIFIED_LABEL,
  type AppliedLimitation,
  type CandidateBenefit,
  type ComparisonCandidate,
} from '@aggregator/shared';
import { describe, expect, it } from 'vitest';

/**
 * A percentage benefit, or `null` for a plan that does not carry it.
 *
 * Unrestricted unless a test says otherwise — which is what an empty limitation
 * list means everywhere else too.
 */
const pct = (
  optionId: string,
  optionName: string,
  value: number | null,
  limitations: AppliedLimitation[] = [],
): CandidateBenefit => ({
  optionId,
  optionName,
  value,
  dataType: 'PERCENTAGE',
  unit: '%',
  carried: value !== null,
  textValue: null,
  limitations,
});

/** A benefit quoted as a ceiling in money — maternity, dental, optical, chronic. */
const money = (
  optionId: string,
  optionName: string,
  value: number | null,
  limitations: AppliedLimitation[] = [],
): CandidateBenefit => ({
  optionId,
  optionName,
  value,
  dataType: 'CURRENCY',
  unit: null,
  carried: value !== null,
  textValue: null,
  limitations,
});

/** A benefit quoted in words rather than numbers, e.g. a provider network. */
const words = (
  optionId: string,
  optionName: string,
  textValue: string | null,
  limitations: AppliedLimitation[] = [],
): CandidateBenefit => ({
  optionId,
  optionName,
  value: null,
  dataType: textValue === null ? null : 'TEXT',
  unit: null,
  carried: textValue !== null,
  textValue,
  limitations,
});

/**
 * A restriction at a given place in its list.
 *
 * Severity is a POSITION, not a number somebody typed: rank 0 is the mildest
 * condition the list holds and `rankCount - 1` the harshest, which is exactly
 * what dragging the list into order says.
 */
const limit = (name: string, rank: number, rankCount: number): AppliedLimitation => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  name,
  rank,
  rankCount,
});

/**
 * A benefit answered from a ranked list, e.g. a provider network.
 *
 * Built the way the API builds it: the stored answer is an id, and `rankValue`
 * turns its place in the employee's list into the number the engine ranks on.
 */
const ranked = (
  optionId: string,
  optionName: string,
  chosenId: string | null,
  choices: { id: string; label: string; sortOrder: number }[],
): CandidateBenefit => ({
  optionId,
  optionName,
  value: rankValue(chosenId, choices),
  dataType: chosenId === null ? null : 'RANK',
  unit: null,
  carried: chosenId !== null,
  textValue: rankLabel(chosenId, choices),
  limitations: [],
});

function plan(
  id: string,
  companyName: string,
  annualPrice: number | null,
  benefits: CandidateBenefit[],
  extra: Partial<ComparisonCandidate> = {},
): ComparisonCandidate {
  return {
    configurationId: id,
    planId: `${id}_plan`,
    planName: `${companyName} plan`,
    companyId: `${id}_company`,
    companyName,
    companyLogoUrl: null,
    medicalNetworkName: null,
    roomType: null,
    currency: 'EGP',
    annualPrice,
    annualLimit: null,
    deductible: null,
    coPayment: null,
    customerTypeLabel: 'Individual',
    geographicalCoverageLabel: 'Local',
    benefits,
    ...extra,
  };
}

const recommended = (results: ReturnType<typeof scoreCandidates>) =>
  results.find((result) => result.isRecommended);

describe('comparison engine', () => {
  it('recommends the middle-priced plan when its extra cover is worth the money', () => {
    // The acceptance example: cheap-and-weak, mid, and dear-and-slightly-better.
    const results = scoreCandidates([
      plan('a', 'Company A', 600, [pct('out', 'Outpatient', 60), pct('den', 'Dental', 50)]),
      plan('b', 'Company B', 700, [pct('out', 'Outpatient', 85), pct('den', 'Dental', 80)]),
      plan('c', 'Company C', 800, [pct('out', 'Outpatient', 90), pct('den', 'Dental', 85)]),
    ]);

    expect(recommended(results)?.configurationId).toBe('b');
    // The engine still knows which extreme is which.
    expect(results.find((r) => r.configurationId === 'a')?.isCheapest).toBe(true);
    expect(results.find((r) => r.configurationId === 'c')?.isHighestCoverage).toBe(true);
    // Neither extreme won, which is the whole point.
    expect(recommended(results)?.isCheapest).toBe(false);
    expect(recommended(results)?.isHighestCoverage).toBe(false);
  });

  it('recommends the cheapest plan when it is also the strongest', () => {
    const results = scoreCandidates([
      plan('cheap', 'Company A', 500, [pct('out', 'Outpatient', 95)]),
      plan('dear', 'Company B', 900, [pct('out', 'Outpatient', 60)]),
    ]);

    const winner = recommended(results);
    expect(winner?.configurationId).toBe('cheap');
    expect(winner?.isCheapest).toBe(true);
    expect(winner?.isHighestCoverage).toBe(true);
  });

  it('recommends the richest plan when the extra cover costs almost nothing', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 600, [pct('out', 'Outpatient', 50)]),
      plan('b', 'Company B', 700, [pct('out', 'Outpatient', 75)]),
      plan('c', 'Company C', 710, [pct('out', 'Outpatient', 95)]),
    ]);

    expect(recommended(results)?.configurationId).toBe('c');
  });

  it('never recommends a plan another plan dominates, and ranks it lower', () => {
    // A costs more than B and covers less: strictly the worse deal.
    const results = scoreCandidates([
      plan('a', 'Company A', 800, [pct('out', 'Outpatient', 70)]),
      plan('b', 'Company B', 700, [pct('out', 'Outpatient', 80)]),
    ]);

    const a = results.find((r) => r.configurationId === 'a')!;
    const b = results.find((r) => r.configurationId === 'b')!;

    expect(a.isDominated).toBe(true);
    expect(a.dominatedBy).toContain('b');
    expect(b.isDominated).toBe(false);
    expect(recommended(results)?.configurationId).toBe('b');
    // Ranked lower, too.
    expect(results.indexOf(b)).toBeLessThan(results.indexOf(a));
  });
  it('treats a missing benefit as missing — never as full cover', () => {
    const results = scoreCandidates([
      plan('has', 'Company A', 700, [pct('out', 'Outpatient', 80), pct('den', 'Dental', 70)]),
      plan('lacks', 'Company B', 700, [pct('out', 'Outpatient', 80), pct('den', 'Dental', null)]),
    ]);

    const lacks = results.find((r) => r.configurationId === 'lacks')!;
    const dental = lacks.benefits.find((cell) => cell.optionId === 'den')!;

    expect(dental.covered).toBe(false);
    expect(dental.value).toBeNull();
    expect(dental.display).toBe('Not covered');
    expect(dental.score).toBe(0);
    expect(lacks.missingBenefitCount).toBe(1);

    // Same price, one covers more: the plan with the gap must not win.
    expect(recommended(results)?.configurationId).toBe('has');
    expect(lacks.coverageScore).toBeLessThan(
      results.find((r) => r.configurationId === 'has')!.coverageScore,
    );
  });

  it('prefers the cheaper plan when the benefits are identical', () => {
    const results = scoreCandidates([
      plan('dear', 'Company A', 900, [pct('out', 'Outpatient', 80)]),
      plan('cheap', 'Company B', 600, [pct('out', 'Outpatient', 80)]),
    ]);

    expect(recommended(results)?.configurationId).toBe('cheap');
  });

  it('prefers the stronger plan when the prices are nearly identical', () => {
    const results = scoreCandidates([
      plan('weak', 'Company A', 700, [pct('out', 'Outpatient', 55)]),
      plan('strong', 'Company B', 705, [pct('out', 'Outpatient', 90)]),
    ]);

    expect(recommended(results)?.configurationId).toBe('strong');
  });

  it('scores a lower deductible and co-payment as better, and a bigger limit as better', () => {
    const results = scoreCandidates([
      plan('good', 'Company A', 700, [pct('out', 'Outpatient', 80)], {
        annualLimit: 100_000,
        deductible: 5_000,
        coPayment: 10,
      }),
      plan('poor', 'Company B', 700, [pct('out', 'Outpatient', 80)], {
        annualLimit: 50_000,
        deductible: 10_000,
        coPayment: 20,
      }),
    ]);

    const good = results.find((r) => r.configurationId === 'good')!;
    const poor = results.find((r) => r.configurationId === 'poor')!;
    const cell = (result: typeof good, id: string) => result.attributes.find((a) => a.id === id)!;

    expect(cell(good, 'annualLimit').isBest).toBe(true);
    expect(cell(good, 'deductible').isBest).toBe(true); // 5,000 beats 10,000
    expect(cell(good, 'coPayment').isBest).toBe(true); // 10% beats 20%
    expect(cell(poor, 'deductible').isBest).toBe(false);

    expect(good.coverageScore).toBeGreaterThan(poor.coverageScore);
    expect(recommended(results)?.configurationId).toBe('good');
  });

  it('breaks a genuine tie deterministically, recommending exactly one plan', () => {
    const build = () => [
      plan('zzz', 'Company Z', 700, [pct('out', 'Outpatient', 80)]),
      plan('aaa', 'Company A', 700, [pct('out', 'Outpatient', 80)]),
    ];

    const first = scoreCandidates(build());
    const second = scoreCandidates(build().reverse());

    expect(first.filter((r) => r.isRecommended)).toHaveLength(1);
    expect(recommended(first)?.configurationId).toBe(recommended(second)?.configurationId);
  });

  it('handles a single match and no match at all', () => {
    expect(scoreCandidates([])).toEqual([]);

    const only = scoreCandidates([plan('solo', 'Company A', 700, [pct('out', 'Outpatient', 80)])]);
    expect(only).toHaveLength(1);
    expect(only[0]!.isRecommended).toBe(true);
  });

  it('explains the recommendation from the numbers of that comparison', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 600, [pct('out', 'Outpatient', 60), pct('den', 'Dental', 50)]),
      plan('b', 'Company B', 700, [pct('out', 'Outpatient', 85), pct('den', 'Dental', 80)]),
      plan('c', 'Company C', 800, [pct('out', 'Outpatient', 90), pct('den', 'Dental', 85)]),
    ]);

    const reasons = explainRecommendation(results);
    expect(reasons.length).toBeGreaterThan(0);
    // Built from this comparison's own data, not a canned sentence.
    expect(reasons.join(' ')).toMatch(/Outpatient|Dental/);
    expect(reasons.join(' ')).toMatch(/85%|80%|700|800/);

    // A different comparison must produce different wording.
    const other = explainRecommendation(
      scoreCandidates([
        plan('x', 'Company X', 400, [pct('out', 'Outpatient', 95)]),
        plan('y', 'Company Y', 900, [pct('out', 'Outpatient', 40)]),
      ]),
    );
    expect(other.join(' ')).not.toBe(reasons.join(' '));
  });
  it('ranks the weakest cover above no cover at all', () => {
    // 60% is the worst outpatient figure in the set, but it is still cover.
    const results = scoreCandidates([
      plan('weakest', 'Company A', 700, [pct('out', 'Outpatient', 60)]),
      plan('none', 'Company B', 700, [pct('out', 'Outpatient', null)]),
      plan('best', 'Company C', 900, [pct('out', 'Outpatient', 90)]),
    ]);

    const weakest = results.find((r) => r.configurationId === 'weakest')!;
    const none = results.find((r) => r.configurationId === 'none')!;

    expect(weakest.benefits[0]!.score).toBeGreaterThan(none.benefits[0]!.score);
    expect(weakest.coverageScore).toBeGreaterThan(none.coverageScore);
    expect(results.indexOf(weakest)).toBeLessThan(results.indexOf(none));
  });

  it('never lets plan attributes outweigh the benefits the customer chose', () => {
    // A plan with excellent limits but none of the requested cover must not
    // beat a plan that actually provides that cover.
    const results = scoreCandidates([
      plan('covers', 'Company A', 1000, [pct('out', 'Outpatient', 60), pct('den', 'Dental', 50)]),
      plan(
        'attributes-only',
        'Company B',
        1000,
        [pct('out', 'Outpatient', null), pct('den', 'Dental', null)],
        { annualLimit: 1_000_000, deductible: 0, coPayment: 0 },
      ),
    ]);

    const covers = results.find((r) => r.configurationId === 'covers')!;
    const attributesOnly = results.find((r) => r.configurationId === 'attributes-only')!;

    expect(covers.coverageScore).toBeGreaterThan(attributesOnly.coverageScore);
    expect(recommended(results)?.configurationId).toBe('covers');
  });

  it('does not punish a plan for leaving an attribute blank', () => {
    // Same benefits, same price; one simply declares no deductible.
    const results = scoreCandidates([
      plan('declares', 'Company A', 700, [pct('out', 'Outpatient', 80)], { deductible: 5_000 }),
      plan('blank', 'Company B', 700, [pct('out', 'Outpatient', 80)]),
    ]);

    const blank = results.find((r) => r.configurationId === 'blank')!;
    // Judged on its benefits alone rather than scored zero for the blank.
    expect(blank.coverageScore).toBeGreaterThan(0);
    expect(blank.attributes.find((a) => a.id === 'deductible')!.value).toBeNull();
  });
  it('does not claim strong cover when no matching plan carries the benefit', () => {
    // Both plans match the criteria; neither provides what was asked for.
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [pct('out', 'Outpatient', null)], { annualLimit: 200 }),
      plan('b', 'Company B', 1000, [pct('out', 'Outpatient', null)], { annualLimit: 20 }),
    ]);

    const reasons = explainRecommendation(results).join(' ');
    expect(reasons).toMatch(/No matching plan records any benefit/i);
    // The contradiction this replaced: claiming the strongest cover while
    // sitting next to "does not cover 1 of the benefits".
    expect(reasons).not.toMatch(/strongest on the benefits/i);
    expect(reasons).not.toMatch(/does not cover 1 of the benefits/i);
  });
});

/**
 * The qualifications a plan attaches to its cover.
 *
 * These are the cases the free-text note could not decide: two plans quoting
 * the same figure where one pays for everything and the other only for basic
 * procedures, and benefits quoted in words that used to score the same as no
 * cover at all.
 */
describe('limitations', () => {
  it('ranks unrestricted cover above the same figure with conditions on it', () => {
    const results = scoreCandidates([
      plan('open', 'Company A', 1000, [pct('den', 'Dental', 80)]),
      plan('closed', 'Company B', 1000, [
        pct('den', 'Dental', 80, [limit('Basic procedures only', 2, 4)]),
      ]),
    ]);

    const open = results.find((r) => r.configurationId === 'open')!;
    const closed = results.find((r) => r.configurationId === 'closed')!;

    expect(open.benefits[0]!.score).toBeGreaterThan(closed.benefits[0]!.score);
    // Same figure on both, so the conditions are the only thing separating them.
    expect(open.benefits[0]!.display).toBe(closed.benefits[0]!.display);
    expect(open.benefits[0]!.isBest).toBe(true);
    expect(closed.benefits[0]!.isBest).toBe(false);
    expect(recommended(results)?.configurationId).toBe('open');
  });

  it('treats no limitations as unrestricted, never as unknown', () => {
    const results = scoreCandidates([plan('a', 'Company A', 1000, [pct('den', 'Dental', 80)])]);

    const cell = results[0]!.benefits[0]!;
    expect(cell.limitations).toEqual([]);
    expect(cell.limitationFactor).toBe(1);
    expect(cell.limitationsDisplay).toMatch(/no limitations/i);
  });

  it('compounds several conditions instead of adding them up', () => {
    const results = scoreCandidates([
      plan('one', 'Company A', 1000, [pct('den', 'Dental', 80, [limit('Harshest', 4, 5)])]),
      plan('two', 'Company B', 1000, [
        pct('den', 'Dental', 80, [limit('Middling', 2, 5), limit('Also middling', 2, 5)]),
      ]),
    ]);

    const one = results.find((r) => r.configurationId === 'one')!.benefits[0]!;
    const two = results.find((r) => r.configurationId === 'two')!.benefits[0]!;

    // Compounding, not adding: two middling conditions keep more than one at
    // the bottom of the list, so splitting a restriction across two entries
    // cannot make it bite harder than stating it once.
    expect(two.limitationFactor).toBeGreaterThan(one.limitationFactor);
  });

  it('costs nothing at the top of the list and most at the bottom', () => {
    const results = scoreCandidates([
      plan('mild', 'Company A', 1000, [pct('den', 'Dental', 80, [limit('Mildest', 0, 4)])]),
      plan('harsh', 'Company B', 1000, [pct('den', 'Dental', 80, [limit('Harshest', 3, 4)])]),
    ]);

    const mild = results.find((r) => r.configurationId === 'mild')!.benefits[0]!;
    const harsh = results.find((r) => r.configurationId === 'harsh')!.benefits[0]!;

    // The top of the list is the mildest condition the list holds, so carrying
    // only it is not a mark against the plan at all.
    expect(mild.limitationFactor).toBe(1);
    expect(harsh.limitationFactor).toBeLessThan(1);
    expect(recommended(results)?.configurationId).toBe('mild');
  });

  it('re-ranks every plan when the list is reordered, and only then', () => {
    const cell = (rank: number) =>
      scoreCandidates([
        plan('a', 'Company A', 1000, [
          pct('den', 'Dental', 80, [limit('In-network only', rank, 4)]),
        ]),
      ])[0]!.benefits[0]!;

    // The same condition, before and after it is dragged to the harsh end.
    const before = cell(1);
    const after = cell(3);

    expect(after.limitationFactor).toBeLessThan(before.limitationFactor);
    // What the plan SAYS is untouched: it still imposes the same condition.
    expect(after.limitationsDisplay).toBe(before.limitationsDisplay);
  });

  it('does not let a list of one invent a penalty', () => {
    // A list holding a single condition discriminates between nothing, so every
    // plan carrying it sits in the same place and it costs nothing.
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [pct('den', 'Dental', 80, [limit('The only one', 0, 1)])]),
    ]);

    expect(results[0]!.benefits[0]!.limitationFactor).toBe(1);
  });

  it('keeps heavily restricted cover above no cover at all', () => {
    const results = scoreCandidates([
      plan('restricted', 'Company A', 1000, [
        pct('den', 'Dental', 80, [
          limit('In-network only', 3, 4),
          limit('Basic procedures only', 3, 4),
          limit('Prior approval', 3, 4),
        ]),
      ]),
      plan('absent', 'Company B', 1000, [pct('den', 'Dental', null)]),
    ]);

    const restricted = results.find((r) => r.configurationId === 'restricted')!.benefits[0]!;
    const absent = results.find((r) => r.configurationId === 'absent')!.benefits[0]!;

    // Silence must never outrank disclosure: a plan that states its conditions
    // is still providing cover the other one does not.
    expect(restricted.score).toBeGreaterThan(absent.score);
    expect(absent.score).toBe(0);
  });

  it('ranks a benefit quoted in words above a plan that omits it', () => {
    const results = scoreCandidates([
      plan('has', 'Company A', 1000, [words('phys', 'Physiotherapy', 'Covered')]),
      plan('lacks', 'Company B', 1000, [words('phys', 'Physiotherapy', null)]),
    ]);

    const has = results.find((r) => r.configurationId === 'has')!.benefits[0]!;
    const lacks = results.find((r) => r.configurationId === 'lacks')!.benefits[0]!;

    expect(has.covered).toBe(true);
    expect(has.score).toBeGreaterThan(0);
    expect(lacks.covered).toBe(false);
    expect(lacks.display).toBe('Not covered');
  });

  it('separates two plans that both quote a benefit in words', () => {
    const results = scoreCandidates([
      plan('open', 'Company A', 1000, [words('phys', 'Physiotherapy', 'Covered')]),
      plan('vague', 'Company B', 1000, [
        words('phys', 'Physiotherapy', 'Not specified', [limit('Not specified', 3, 4)]),
      ]),
    ]);

    const open = results.find((r) => r.configurationId === 'open')!.benefits[0]!;
    const vague = results.find((r) => r.configurationId === 'vague')!.benefits[0]!;

    expect(open.score).toBeGreaterThan(vague.score);
    // The wording still reaches the screen; the ranking comes from the record.
    expect(vague.display).toBe('Not specified');
  });

  it('says what separated two plans quoting the same figure', () => {
    const results = scoreCandidates([
      plan('open', 'Company A', 1200, [pct('den', 'Dental', 80)]),
      plan('closed', 'Company B', 1000, [
        pct('den', 'Dental', 80, [limit('In-network only', 2, 4)]),
      ]),
    ]);

    const reasons = explainRecommendation(results).join(' ');
    // Never "80% vs 80%", which reads as a mistake.
    expect(reasons).not.toMatch(/80% vs 80%/);
    if (recommended(results)?.configurationId === 'open') {
      expect(reasons.toLowerCase()).toMatch(/in-network only|no limitations/);
    }
  });
});

/**
 * Cover that is a NAMED TIER rather than a figure.
 *
 * "Golden Care Network" carries no percentage, so as free text the comparison
 * could not say whether it beat "Orange Care Network" — both scored zero, the
 * same as a plan with no network at all. The employee orders the list once and
 * every plan quoting a network is ranked by where its answer sits.
 */
describe('ranked answers', () => {
  const NETWORKS = [
    { id: 'gold', label: 'Golden Care Network', sortOrder: 0 },
    { id: 'orange', label: 'Orange Care Network', sortOrder: 1 },
  ];

  it('ranks the plan whose answer sits higher in the list', () => {
    const results = scoreCandidates([
      plan('better', 'Company A', 1000, [ranked('net', 'Medical Network', 'gold', NETWORKS)]),
      plan('worse', 'Company B', 1000, [ranked('net', 'Medical Network', 'orange', NETWORKS)]),
    ]);

    const better = results.find((r) => r.configurationId === 'better')!.benefits[0]!;
    const worse = results.find((r) => r.configurationId === 'worse')!.benefits[0]!;

    expect(better.score).toBeGreaterThan(worse.score);
    expect(better.isBest).toBe(true);
    expect(recommended(results)?.configurationId).toBe('better');
  });

  it(`shows the answer's name, never its position`, () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [ranked('net', 'Medical Network', 'gold', NETWORKS)]),
    ]);

    // The number exists only so the list can be sorted; nobody reads "2".
    expect(results[0]!.benefits[0]!.display).toBe('Golden Care Network');
  });

  it('keeps the worst answer on the list above no answer at all', () => {
    const results = scoreCandidates([
      plan('worst', 'Company A', 1000, [ranked('net', 'Medical Network', 'orange', NETWORKS)]),
      plan('none', 'Company B', 1000, [ranked('net', 'Medical Network', null, NETWORKS)]),
    ]);

    const worst = results.find((r) => r.configurationId === 'worst')!.benefits[0]!;
    const none = results.find((r) => r.configurationId === 'none')!.benefits[0]!;

    expect(worst.score).toBeGreaterThan(none.score);
    expect(none.display).toBe('Not covered');
  });

  it('reorders the ranking without touching what any plan says', () => {
    const before = rankValue('orange', NETWORKS);
    // The employee drags Orange above Golden. No plan value changes — plans
    // hold the answer's id — but Orange is now the better cover.
    const after = rankValue('orange', [
      { id: 'orange', label: 'Orange Care Network', sortOrder: 0 },
      { id: 'gold', label: 'Golden Care Network', sortOrder: 1 },
    ]);

    expect(after).toBeGreaterThan(before!);
  });

  it('treats an answer no longer on the list as unrankable, not as worst', () => {
    // A deleted answer, or one recorded before the benefit became ranked.
    expect(rankValue('gone', NETWORKS)).toBeNull();
    expect(rankLabel('gone', NETWORKS)).toBeNull();
  });
});

/**
 * EMPTY IS AN ANSWER, AND IT IS NOT ZERO.
 *
 * A figure the document never stated is not 0%, not missing data and not a
 * fault. It reads as the business's own wording — and a figure that IS zero
 * still reads as zero, because a document stating 0% said something real that
 * has to survive to the screen.
 */
describe('a figure the plan never stated', () => {
  /** On the plan, with no percentage written against it. */
  const unquoted = (optionId: string, optionName: string): CandidateBenefit => ({
    optionId,
    optionName,
    value: null,
    dataType: 'PERCENTAGE',
    unit: '%',
    carried: true,
    textValue: null,
    limitations: [],
  });

  it('reads as not specified — never as 0%, and never as covered in full', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [unquoted('den', 'Dental')]),
      plan('b', 'Company B', 1100, [pct('den', 'Dental', 80)]),
    ]);

    const cell = results.find((r) => r.configurationId === 'a')!.benefits[0]!;
    expect(cell.value).toBeNull();
    expect(cell.display).toBe(NOT_SPECIFIED_LABEL);
    expect(cell.display).not.toContain('0');
    // "Covered" would promise cover in full that no document offered.
    expect(cell.display).not.toBe('Covered');
  });

  it('reads a stated zero as the plan declining the area', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [pct('den', 'Dental', 0)]),
      plan('b', 'Company B', 1100, [pct('den', 'Dental', 20)]),
    ]);

    const cell = results.find((r) => r.configurationId === 'a')!.benefits[0]!;

    /**
     * A document that writes 0 said something — and what it said is "we do not
     * cover this". Showing it as 0% would read as the weakest cover on offer,
     * which is a different and better claim than none at all.
     */
    expect(cell.value).toBe(0);
    expect(cell.display).toBe(NOT_COVERED_LABEL);
    expect(cell.display).not.toBe(NOT_SPECIFIED_LABEL);
    expect(cell.display).not.toContain('0');
  });

  it('scores a stated zero as no cover, so it never outranks a real figure', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [pct('den', 'Dental', 0)]),
      plan('b', 'Company B', 1000, [pct('den', 'Dental', 10)]),
    ]);

    const declined = results.find((r) => r.configurationId === 'a')!;
    const thin = results.find((r) => r.configurationId === 'b')!;

    /**
     * Same premium, and the only difference is that one plan covers dental
     * thinly and the other not at all. Ranking 0 as a figure would put them
     * a hair apart; it is the whole benefit.
     */
    expect(thin.coverageScore).toBeGreaterThan(declined.coverageScore);
    expect(declined.benefits[0]!.covered).toBe(false);
    expect(thin.benefits[0]!.covered).toBe(true);
  });

  it('reads a zero ceiling the same way it reads a zero percentage', () => {
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [money('mat', 'Maternity', 0)]),
      plan('b', 'Company B', 1100, [money('mat', 'Maternity', 40000)]),
    ]);

    // The rule is about the figure, not about which kind of figure it is.
    const cell = results.find((r) => r.configurationId === 'a')!.benefits[0]!;
    expect(cell.display).toBe(NOT_COVERED_LABEL);
    expect(cell.covered).toBe(false);
  });

  it('still tells an unquoted benefit apart from one the plan lacks', () => {
    const results = scoreCandidates([
      plan('has', 'Company A', 1000, [unquoted('den', 'Dental')]),
      plan('lacks', 'Company B', 1100, [pct('den', 'Dental', null)]),
    ]);

    const has = results.find((r) => r.configurationId === 'has')!.benefits[0]!;
    const lacks = results.find((r) => r.configurationId === 'lacks')!.benefits[0]!;

    // Two different facts, and neither is allowed to read as the other.
    expect(has.display).toBe(NOT_SPECIFIED_LABEL);
    expect(lacks.display).toBe('Not covered');
    expect(has.display).not.toBe(lacks.display);
  });

  it('says not specified for a ranked answer nobody chose', () => {
    const choices = [{ id: 'gold', label: 'Golden Care Network', sortOrder: 0 }];
    const results = scoreCandidates([
      plan('a', 'Company A', 1000, [{ ...ranked('net', 'Network', null, choices), carried: true }]),
      plan('b', 'Company B', 1100, [ranked('net', 'Network', 'gold', choices)]),
    ]);

    expect(results.find((r) => r.configurationId === 'a')!.benefits[0]!.display).toBe(
      NOT_SPECIFIED_LABEL,
    );
  });
});
