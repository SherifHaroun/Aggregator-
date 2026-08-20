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
  scoreCandidates,
  type CandidateBenefit,
  type ComparisonCandidate,
} from '@aggregator/shared';
import { describe, expect, it } from 'vitest';

/** A percentage benefit, or `null` for a plan that does not carry it. */
const pct = (optionId: string, optionName: string, value: number | null): CandidateBenefit => ({
  optionId,
  optionName,
  value,
  dataType: 'PERCENTAGE',
  unit: '%',
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
    planCategory: null,
    companyId: `${id}_company`,
    companyName,
    companyLogoUrl: null,
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
