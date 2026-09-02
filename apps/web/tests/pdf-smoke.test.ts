/**
 * THE DOCUMENT A CUSTOMER IS SENT, CHECKED AS A FILE.
 *
 * The other tests check what the PDF SAYS. This one checks that it is a PDF:
 * a reader that cannot find an object where the cross-reference table promises
 * it refuses the whole file, and a document whose text is perfect is worth
 * nothing if it will not open.
 */
import { describe, expect, it } from 'vitest';
import { buildPlanDocument } from '@/features/comparison/plan-document';

const cell = (name: string, value: number | null, pct: boolean) => ({
  optionId: name, optionName: name, covered: value !== null && value !== 0, value,
  display: String(value), dataType: (pct ? 'PERCENTAGE' : 'CURRENCY') as const,
  unit: pct ? '%' : null, direction: 'HIGHER_IS_BETTER' as const, score: 1, isBest: false,
  limitations: [{ id: 'a', name: 'Basic procedures only' }], limitationsDisplay: null, limitationFactor: 1,
});

describe('the plan document', () => {
  it('writes a file that opens', async () => {
    const plan = {
      configurationId: 'c', planId: 'p', planName: 'Golden Plan',
      companyId: 'co', companyName: 'MetLife', companyLogoUrl: null,
      medicalNetworkName: 'Golden Care Network', roomType: null, currency: 'EGP',
      annualPrice: 5191, pricedEmployeeCount: null,
      customerTypeLabel: 'Individual', geographicalCoverageLabel: 'Local',
      benefits: [
        cell('In-patient', 100, true), cell('Out-patient', 90, true),
        cell('Maternity', 3000, false), cell('Dental', 500, false),
        cell('Optical', 0, false), cell('Chronic / Pre-existing Conditions', null, false),
      ],
      attributes: [{ id: 'annualLimit' as const, label: 'Annual limit', value: 50000,
        display: '50,000', direction: 'HIGHER_IS_BETTER' as const, score: 1, isBest: true }],
      coverageScore: 0.8, priceScore: 0.5, valueScore: 0.7, missingBenefitCount: 1,
      isDominated: false, dominatedBy: [], isRecommended: true, isCheapest: false, isHighestCoverage: false,
    };

    /** Enough additional benefits to force the tables onto more than one page. */
    const additional = Array.from({ length: 40 }, (_, i) => ({
      name: `Additional benefit number ${i + 1} with a deliberately long name to test wrapping`,
      value: i % 3 === 0 ? 'Covered' : `${(i + 1) * 250}`,
      details: [`A qualifying note for benefit ${i + 1} that is long enough to wrap onto a second line of its own.`],
    }));

    const { blob, filename } = buildPlanDocument({
      plan: plan as never, additional,
      waitingPeriods: ['Maternity: 10 months', 'Pre-existing: 12 months'],
      conditions: ['Group size 21-200 employees.', 'MetLife enforces 100% enrolment.'],
      exclusions: ['Cosmetic surgery.', 'Experimental treatment.'],
      description: 'MetLife SME health plan, Medium tier.',
    });

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsBinaryString(blob);
    });

    // More than one page, and every page carries the running header.
    const pages = (text.match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    expect((text.match(/HADBROK/g) ?? []).length).toBe(pages);
    // Parentheses are escaped inside a PDF string, so that is how they read.
    expect(text).toContain(String.raw`\(continued\)`);
    expect(text).toContain('Page 1');

    expect(filename).toBe('MetLife-Golden-Plan-Plan-Details.pdf');

    /**
     * THE CROSS-REFERENCE TABLE HAS TO BE RIGHT.
     *
     * It is a list of byte offsets, one per object, and a reader that looks at
     * one and does not find the object there rejects the file outright. Nothing
     * about the text on the page would reveal that.
     */
    const startxref = Number(text.slice(text.lastIndexOf('startxref') + 9).trim().split(/\s/)[0]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');

    const rows = text.slice(startxref).split(String.fromCharCode(10));
    const objectCount = Number(rows[1]!.split(' ')[1]);
    for (let id = 1; id < objectCount; id += 1) {
      const offset = Number(rows[2 + id]!.split(' ')[0]);
      expect(text.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
    }

    // A stream whose declared length is wrong is the other way a reader balks.
    const streams = [...text.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
    expect(streams).toHaveLength(pages);
    for (const match of streams) {
      expect(match[2]!.length).toBe(Number(match[1]));
    }
  });
});
