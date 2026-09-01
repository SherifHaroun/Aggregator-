/**
 * WHAT A COMPARISON PUTS SIDE BY SIDE.
 *
 * Six columns, one per core area, whatever the catalogue happens to call the
 * records underneath them. Everything else a plan carries is read when somebody
 * opens that plan, not when plans are ranked against each other.
 */

import { CORE_MEDICAL_BENEFITS } from '@aggregator/shared';
import { describe, expect, it } from 'vitest';
import {
  discoverComparisonColumns,
  type ComparableOption,
} from '../src/modules/comparison/comparison-columns.js';

/** A benefit attached to a plan, as the comparison reads it. */
const attached = (
  optionId: string,
  name: string,
  dataTypes: string[] = [],
  extras: { isUmbrella?: boolean; parentId?: string | null } = {},
): ComparableOption => ({
  optionId,
  option: {
    name,
    isUmbrella: extras.isUmbrella ?? false,
    parentId: extras.parentId ?? null,
    fields: dataTypes.map((dataType) => ({ dataType })),
  },
});

const variant = (...options: ComparableOption[]) => ({ options });

/** One record per area, named and quoted the way the business fixed. */
const everyCoreArea = () => [
  attached('ip', 'In-patient', ['PERCENTAGE']),
  attached('op', 'Out-patient', ['PERCENTAGE']),
  attached('mat', 'Maternity', ['CURRENCY']),
  attached('den', 'Dental', ['CURRENCY']),
  attached('opt', 'Optical', ['CURRENCY']),
  attached('chr', 'Chronic / Pre-existing Conditions', ['CURRENCY']),
];

describe('the columns a comparison has', () => {
  it('is the six core areas, in the order the business reads them', () => {
    const columns = discoverComparisonColumns([variant(...everyCoreArea())]);

    expect(columns.map((column) => column.name)).toEqual(
      [...CORE_MEDICAL_BENEFITS].sort((a, b) => a.order - b.order).map((benefit) => benefit.name),
    );
    expect(columns).toHaveLength(6);
  });

  it('leaves additional benefits out of the ranking entirely', () => {
    const columns = discoverComparisonColumns([
      variant(
        ...everyCoreArea(),
        attached('phys', 'Physiotherapy', ['CURRENCY']),
        attached('amb', 'Ambulance', ['PERCENTAGE']),
        attached('well', 'Wellness Programme', ['TEXT']),
      ),
    ]);

    /**
     * Physiotherapy is real cover, and it still is not a column: one plan
     * states it and the next says nothing, so scoring on it would rank plans
     * on how fully somebody typed them in rather than on what they pay.
     */
    expect(columns.map((column) => column.name)).not.toContain('Physiotherapy');
    expect(columns).toHaveLength(6);
  });

  it('gives an area ONE column however many records its group holds', () => {
    const columns = discoverComparisonColumns([
      variant(
        attached('den_group', 'Dental', [], { isUmbrella: true }),
        attached('den_limit', 'Dental Limit', ['CURRENCY'], { parentId: 'den_group' }),
        attached('den_pct', 'Dental Coverage', ['PERCENTAGE'], { parentId: 'den_group' }),
        attached('den_note', 'Dental Waiting Period', ['TEXT'], { parentId: 'den_group' }),
      ),
    ]);

    /**
     * The catalogue keeps an area as a heading with several records under it.
     * Only the one quoted the way the area is quoted answers the question —
     * the rest would each become another column headed "Dental".
     */
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ id: 'den_limit', name: 'Dental' });
  });

  it('ignores a record that carries no figure of the area’s kind', () => {
    const columns = discoverComparisonColumns([
      variant(attached('den', 'Dental', ['PERCENTAGE', 'TEXT'])),
    ]);

    /**
     * Dental is a ceiling. A record holding only a percentage is answering a
     * different question, and a column mixing the two would rank 80 above
     * 5,000.
     */
    expect(columns).toHaveLength(0);
  });

  it('heads every column with the business’s own name for the area', () => {
    const columns = discoverComparisonColumns([
      variant(attached('a', 'Inpatient & Daycase', ['PERCENTAGE'])),
      variant(attached('b', 'Inpatient and daycare Details', ['PERCENTAGE'])),
    ]);

    /**
     * Two companies, two words for the same thing, one question. The column is
     * named for the AREA so both plans read as answering it — and the second
     * company's record does not open a column of its own.
     */
    expect(columns).toHaveLength(1);
    expect(columns[0]!.name).toBe('In-patient');
    expect(columns[0]!.id).toBe('a');
  });

  it('has a column for an area only some of the plans state', () => {
    const columns = discoverComparisonColumns([
      variant(attached('ip', 'In-patient', ['PERCENTAGE'])),
      variant(attached('den', 'Dental', ['CURRENCY'])),
    ]);

    /**
     * The column exists because one plan states it; the plan that does not is
     * what the comparison is there to show.
     */
    expect(columns.map((column) => column.name)).toEqual(['In-patient', 'Dental']);
  });

  it('has no columns at all when nothing core is attached', () => {
    const columns = discoverComparisonColumns([
      variant(attached('phys', 'Physiotherapy', ['CURRENCY'])),
    ]);

    expect(columns).toEqual([]);
  });
});
