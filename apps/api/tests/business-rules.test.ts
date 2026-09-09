/**
 * Business-rule and dynamic-field checks that need no database.
 *
 * No insurance data is created here. The option definitions below are invented
 * inside the test to prove the system works for benefits nobody anticipated —
 * they are never written anywhere.
 */

import { geographicalCoverageSchema } from '../src/modules/plan-configurations/plan-configurations.schemas.js';
import {
  BENEFIT_VALUE_KINDS,
  CUSTOMER_TYPES,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
  GEOGRAPHICAL_COVERAGES,
  GEOGRAPHICAL_COVERAGE_IDS,
  DEFAULT_COMPARISON_AGE,
  MAX_INSURABLE_AGE,
  MISSING_CORE_LIMIT_FALLBACK,
  MISSING_CORE_LIMIT_NEEDS_CONFIRMATION,
  importReviewWarnings,
  readyToPublish,
  reviewWarningKey,
  NOT_SOLD_AT_AGE_LABEL,
  listEnabledOptions,
  presentPriceBands,
  resolveComparisonAges,
  variantDisplayName,
  NOT_SPECIFIED_LABEL,
  SME_FIXED_AVERAGE_AGE,
  benefitTypeLabel,
  benefitValueField,
  formatMoney,
  formatNumberInput,
  formatPercentage,
  parseNumberInput,
  resolveAverageAgeForCustomerType,
  usesAgeRange,
  usesFixedAverageAge,
} from '@aggregator/shared';
import type { OptionField, Plan } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toPlanDto } from '../src/modules/plans/plans.mapper.js';
import { buildValueColumns, readValue } from '../src/modules/plan-options/plan-option-values.js';

describe('SME average age stays centralized', () => {
  it('resolves SME to the single configured constant', () => {
    const resolved = resolveAverageAgeForCustomerType('SME');
    expect(resolved.value).toBe(SME_FIXED_AVERAGE_AGE);
    expect(resolved.source).toBe('FIXED_BUSINESS_RULE');
    expect(resolved.label).toBe(`Average age: ${SME_FIXED_AVERAGE_AGE}`);
  });

  it('does not invent an age for Individual or Family', () => {
    for (const customerType of ['INDIVIDUAL', 'FAMILY'] as const) {
      const resolved = resolveAverageAgeForCustomerType(customerType);
      expect(resolved.value).toBeNull();
      expect(resolved.source).toBe('NOT_SPECIFIED');
    }
  });

  it('gives each customer type the age input its cover needs', () => {
    // SME is quoted against the standard age and never asked for one; a family
    // covers a group, so it states a youngest and an eldest.
    expect(CUSTOMER_TYPES.SME.ageInputMode).toBe('FIXED_AVERAGE');
    expect(CUSTOMER_TYPES.INDIVIDUAL.ageInputMode).toBe('SINGLE_AGE');
    expect(CUSTOMER_TYPES.FAMILY.ageInputMode).toBe('AGE_RANGE');

    // SME remains the only type whose age is fixed by a rule.
    expect(usesFixedAverageAge('SME')).toBe(true);
    expect(usesFixedAverageAge('INDIVIDUAL')).toBe(false);
    expect(usesFixedAverageAge('FAMILY')).toBe(false);
    expect(usesAgeRange('FAMILY')).toBe(true);
    expect(usesAgeRange('INDIVIDUAL')).toBe(false);
  });
});

/** Minimal stand-in for a persisted plan row. */
function planRow(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan',
    companyId: 'company',
    insuranceTypeId: 'type',
    customerType: 'SME',
    name: 'Gold+',
    code: 'gold-plus',
    description: null,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as Plan;
}

/**
 * The resolved age follows the CUSTOMER TYPE, which is the plan's. Every
 * variant of an SME plan is sold to the same average life, so asking each
 * variant separately could only ever give the same answer.
 */
describe('plan responses carry the resolved age', () => {
  it('derives the SME average age instead of storing it', () => {
    const dto = toPlanDto(planRow({ customerType: 'SME' }));
    expect(dto.averageAge.value).toBe(SME_FIXED_AVERAGE_AGE);
    expect(dto.averageAge.label).toBe(`Average age: ${SME_FIXED_AVERAGE_AGE}`);
  });

  it('reports no age for an individual plan', () => {
    const dto = toPlanDto(planRow({ customerType: 'INDIVIDUAL' }));
    expect(dto.averageAge.value).toBeNull();
  });
});

/** Builds a field definition of the kind an employee creates at runtime. */
function field(label: string, dataType: OptionField['dataType'], isRequired = false): OptionField {
  return {
    id: `field_${label}`,
    optionId: 'option',
    label,
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    dataType,
    unit: null,
    helpText: null,
    // A core field: shown as soon as the benefit is opened, never a toggle.
    isOptional: false,
    parentFieldId: null,
    // Not revealed by an answer, and applicable to every customer type.
    showWhenChoiceId: null,
    customerTypes: [],
    isRequired,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe('a brand-new employee-created option needs no schema change', () => {
  it('round-trips an option whose fields the code has never seen', () => {
    // Invented on the spot, with a field shape no model anticipates.
    const fields = [
      field('Coverage Percentage', 'PERCENTAGE'),
      field('Annual Limit', 'CURRENCY'),
      field('Maximum Sessions', 'NUMBER'),
    ];
    const values = [70, 15000, 12];

    fields.forEach((definition, index) => {
      const columns = buildValueColumns(definition, values[index]);
      expect(readValue(definition, columns)).toBe(values[index]);
    });
  });

  it('supports a second option with a completely different field shape', () => {
    const fields = [
      field('Available', 'BOOLEAN'),
      field('Provider', 'TEXT'),
      field('Waiting Period', 'NUMBER'),
    ];
    const values = [true, 'Any network clinic', 6];

    fields.forEach((definition, index) => {
      const columns = buildValueColumns(definition, values[index]);
      expect(readValue(definition, columns)).toBe(values[index]);
    });
  });

  it('routes each data type to its own column', () => {
    expect(buildValueColumns(field('N', 'NUMBER'), 5)).toEqual({
      numberValue: 5,
      textValue: null,
      booleanValue: null,
    });
    expect(buildValueColumns(field('T', 'TEXT'), 'x')).toEqual({
      numberValue: null,
      textValue: 'x',
      booleanValue: null,
    });
    expect(buildValueColumns(field('B', 'BOOLEAN'), false)).toEqual({
      numberValue: null,
      textValue: null,
      booleanValue: false,
    });
  });

  it('validates values against the employee-defined type', () => {
    expect(() => buildValueColumns(field('Coverage', 'PERCENTAGE'), 150)).toThrow();
    expect(() => buildValueColumns(field('Limit', 'CURRENCY'), -1)).toThrow();
    expect(() => buildValueColumns(field('Sessions', 'NUMBER'), 'many')).toThrow();
    expect(() => buildValueColumns(field('Available', 'BOOLEAN'), 'yes')).toThrow();
    expect(() => buildValueColumns(field('Waiting', 'NUMBER', true), null)).toThrow();
  });
});

describe('what a benefit carries', () => {
  it('turns each offered kind into exactly one field definition', () => {
    expect(benefitValueField('PERCENTAGE').dataType).toBe('PERCENTAGE');
    expect(benefitValueField('LIMIT').dataType).toBe('CURRENCY');
    expect(benefitValueField('TEXT').dataType).toBe('TEXT');
  });

  it('names every kind exactly once, so no two mean the same data type', () => {
    const dataTypes = Object.values(BENEFIT_VALUE_KINDS).map((kind) => kind.field.dataType);
    expect(new Set(dataTypes).size).toBe(dataTypes.length);
  });

  it('describes a benefit by the kind it carries, and a group as a group', () => {
    expect(benefitTypeLabel([{ dataType: 'CURRENCY' }])).toBe(BENEFIT_VALUE_KINDS.LIMIT.label);
    expect(benefitTypeLabel([{ dataType: 'PERCENTAGE' }])).toBe(
      BENEFIT_VALUE_KINDS.PERCENTAGE.label,
    );
    // A benefit with no fields at all holds nothing: it heads other benefits.
    expect(benefitTypeLabel([])).not.toBe(BENEFIT_VALUE_KINDS.PERCENTAGE.label);
  });
});

describe('figures read the way a plan document writes them', () => {
  it('groups digits in thousands as they are typed', () => {
    expect(formatNumberInput('100000')).toBe('100,000');
    expect(formatNumberInput('1234567.5')).toBe('1,234,567.5');
    // Mid-entry: the decimal point the employee has just typed survives.
    expect(formatNumberInput('1000.')).toBe('1,000.');
    expect(formatNumberInput('')).toBe('');
  });

  it('sends the plain number, whatever was pasted in', () => {
    expect(parseNumberInput('100,000')).toBe('100000');
    expect(parseNumberInput('1,000 EGP')).toBe('1000');
    expect(parseNumberInput('')).toBe('');
  });

  it('says a figure was never stated rather than showing a zero or a dash', () => {
    expect(formatMoney(null, 'EGP')).toBe(NOT_SPECIFIED_LABEL);
    expect(formatPercentage(null)).toBe(NOT_SPECIFIED_LABEL);
    expect(formatMoney(100000, 'EGP')).toBe('100,000 EGP');
    expect(formatPercentage(20)).toBe('20%');
  });
});

/**
 * WHERE A PLAN COVERS, and the two answers the business gives.
 */
describe('geographical coverage', () => {
  it('offers Local and International, and nothing else', () => {
    /**
     * A plan covering both is sold as TWO variants — which is what the rest of
     * the model already assumes when it prices and compares them separately.
     * "Other" said nothing about where at all, so a comparison could only read
     * it as "not one of the above": a variant nobody could be matched against
     * on the one question the field exists to answer.
     */
    expect(listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => option.label)).toEqual([
      'Local',
      'International',
    ]);
    expect(ENABLED_GEOGRAPHICAL_COVERAGE_IDS).toEqual(['LOCAL', 'INTERNATIONAL']);
  });

  it('keeps a retired scope readable, so an old variant still says where', () => {
    /**
     * Retiring a scope is not deciding it never existed. The enum value stays,
     * so a variant recorded under it still loads and still carries its label —
     * dropping one is a migration that fails the moment a row uses it.
     */
    expect(GEOGRAPHICAL_COVERAGE_IDS).toContain('WORLDWIDE');
    expect(GEOGRAPHICAL_COVERAGES.WORLDWIDE.label).toBe('Worldwide');
    expect(variantDisplayName('Gold+', 'WORLDWIDE')).toBe('Gold+ Worldwide');
  });

  it('refuses to save a variant under a retired scope', () => {
    // Not merely absent from the pickers: a request typed by hand is refused
    // too, which is the only version of the rule that actually holds.
    expect(geographicalCoverageSchema.safeParse('LOCAL').success).toBe(true);
    expect(geographicalCoverageSchema.safeParse('INTERNATIONAL').success).toBe(true);
    for (const retired of ['LOCAL_AND_INTERNATIONAL', 'WORLDWIDE', 'OTHER']) {
      expect(geographicalCoverageSchema.safeParse(retired).success).toBe(false);
    }
  });
});

describe('a comparison with the age left blank', () => {
  it('runs at the standard age, and says the age was assumed', () => {
    expect(resolveComparisonAges('INDIVIDUAL', null, null)).toEqual({
      ageFrom: DEFAULT_COMPARISON_AGE,
      ageTo: DEFAULT_COMPARISON_AGE,
      assumed: true,
    });
    expect(resolveComparisonAges('FAMILY', undefined, undefined).assumed).toBe(true);
  });

  it('is the one standard age the business reasons about', () => {
    // Not a second constant that could drift from the SME rule.
    expect(DEFAULT_COMPARISON_AGE).toBe(SME_FIXED_AVERAGE_AGE);
  });

  it('reads one age as a range of one', () => {
    expect(resolveComparisonAges('FAMILY', 4, null)).toEqual({
      ageFrom: 4,
      ageTo: 4,
      assumed: false,
    });
    expect(resolveComparisonAges('FAMILY', null, 52)).toEqual({
      ageFrom: 52,
      ageTo: 52,
      assumed: false,
    });
  });

  it('keeps both ends when both were given', () => {
    expect(resolveComparisonAges('FAMILY', 4, 52)).toEqual({
      ageFrom: 4,
      ageTo: 52,
      assumed: false,
    });
  });

  it('ages an SME by the rule whatever was sent, and never calls that an assumption', () => {
    expect(resolveComparisonAges('SME', 50, 60)).toEqual({
      ageFrom: SME_FIXED_AVERAGE_AGE,
      ageTo: SME_FIXED_AVERAGE_AGE,
      assumed: false,
    });
    expect(resolveComparisonAges('SME', null, null).assumed).toBe(false);
  });
});

describe('the rate table as the customer reads it', () => {
  const bands = [
    { ageFrom: 18, ageTo: 64, annualPrice: 5701 },
    { ageFrom: 0, ageTo: 17, annualPrice: 3000 },
    { ageFrom: 65, ageTo: MAX_INSURABLE_AGE, annualPrice: null },
  ];

  it('lists the bands youngest first, however they were stored', () => {
    const table = presentPriceBands(bands, 'EGP', { ageFrom: 35, ageTo: 35 }, MAX_INSURABLE_AGE);
    expect(table.bands.map((band) => band.ageLabel)).toEqual(['0–17', '18–64', '65+']);
  });

  it('marks the band that priced the comparison, and only that one', () => {
    const table = presentPriceBands(bands, 'EGP', { ageFrom: 35, ageTo: 35 }, MAX_INSURABLE_AGE);
    expect(table.bands.map((band) => band.applies)).toEqual([false, true, false]);
    // A family is priced by the band that spans ALL of them.
    const family = presentPriceBands(bands, 'EGP', { ageFrom: 4, ageTo: 40 }, MAX_INSURABLE_AGE);
    expect(family.bands.every((band) => !band.applies)).toBe(true);
    // No ages, no band — an SME priced across its workforce.
    const workforce = presentPriceBands(bands, 'EGP', null, MAX_INSURABLE_AGE);
    expect(workforce.bands.every((band) => !band.applies)).toBe(true);
    expect(workforce.marker).toBeNull();
  });

  it('says in words where the plan is not sold, and never a zero', () => {
    const table = presentPriceBands(bands, 'EGP', null, MAX_INSURABLE_AGE);
    expect(table.bands.map((band) => band.display)).toEqual([
      'EGP 3,000',
      'EGP 5,701',
      NOT_SOLD_AT_AGE_LABEL,
    ]);
    expect(table.lowest).toBe(3000);
    expect(table.highest).toBe(5701);
  });

  it('places every band on one axis so a bar can be drawn from it', () => {
    const table = presentPriceBands(bands, 'EGP', { ageFrom: 35, ageTo: 35 }, MAX_INSURABLE_AGE);
    expect(table.bands[0]!.start).toBe(0);
    expect(table.bands[2]!.end).toBe(1);
    for (const [index, band] of table.bands.entries()) {
      expect(band.end).toBeGreaterThan(band.start);
      if (index > 0) expect(band.start).toBeCloseTo(table.bands[index - 1]!.end, 6);
    }
    // The pin sits inside the band that applies.
    const applying = table.bands.find((band) => band.applies)!;
    expect(table.marker).toBeGreaterThan(applying.start);
    expect(table.marker).toBeLessThan(applying.end);
  });

  it('has nothing to draw for a plan with no bands', () => {
    const table = presentPriceBands([], 'EGP', null, MAX_INSURABLE_AGE);
    expect(table.bands).toEqual([]);
    expect(table.lowest).toBeNull();
  });
});

describe('an open-ended top band on the rate-table bar', () => {
  it('is drawn no wider than the widest ordinary band', () => {
    const table = presentPriceBands(
      [
        { ageFrom: 0, ageTo: 20, annualPrice: 4030 },
        { ageFrom: 21, ageTo: 25, annualPrice: 4154 },
        { ageFrom: 26, ageTo: 64, annualPrice: 6669 },
        // "65+", recorded as running to the oldest insurable age.
        { ageFrom: 65, ageTo: MAX_INSURABLE_AGE, annualPrice: null },
      ],
      'EGP',
      null,
      MAX_INSURABLE_AGE,
    );
    const widths = table.bands.map((band) => band.end - band.start);
    // Its label still says what it is; only its drawn width is capped.
    expect(table.bands[3]!.ageLabel).toBe('65+');
    expect(widths[3]).toBeLessThanOrEqual(Math.max(widths[0]!, widths[1]!, widths[2]!) + 1e-9);
    expect(table.bands[3]!.end).toBe(1);
    // The real bounds are still reported.
    expect(table.maxAge).toBe(MAX_INSURABLE_AGE);
  });

  it('is drawn to scale when it is the only band', () => {
    const table = presentPriceBands(
      [{ ageFrom: 0, ageTo: MAX_INSURABLE_AGE, annualPrice: 4000 }],
      'EGP',
      { ageFrom: 35, ageTo: 35 },
      MAX_INSURABLE_AGE,
    );
    expect(table.bands[0]!.start).toBe(0);
    expect(table.bands[0]!.end).toBe(1);
    expect(table.marker).toBeCloseTo(35.5 / 121, 6);
  });
});

describe('an imported plan with an unstated core limit waits to be confirmed', () => {
  const draft = {
    name: 'Elite',
    currency: 'EGP',
    annualLimit: 600000,
    coreBenefits: [
      { name: 'In-patient', value: 100 },
      { name: 'Out-patient', value: 100 },
      { name: 'Maternity', value: 10000 },
      { name: 'Dental', value: null },
      { name: 'Optical', value: 0 },
      // Medication absent altogether: the document was silent.
    ],
  };

  it('is the decided policy: annual limit, confirmed by a person', () => {
    expect(MISSING_CORE_LIMIT_FALLBACK).toBe('ANNUAL_LIMIT');
    expect(MISSING_CORE_LIMIT_NEEDS_CONFIRMATION).toBe(true);
  });

  it('flags each LIMIT area with no figure, and nothing else', () => {
    const warnings = importReviewWarnings(draft);
    /**
     * Dental (null), Chronic (absent) and Medication (absent) are silent.
     * Optical at 0 is declined, which the document said; Maternity has a
     * figure; the coverage areas are percentages and never fall back.
     */
    expect(warnings.map((warning) => warning.benefit)).toEqual([
      'Dental',
      'Chronic / Pre-existing Conditions',
      'Medication',
    ]);
    for (const warning of warnings) {
      expect(warning.plan).toBe('Elite');
      expect(warning.blocksPublish).toBe(true);
      // Says which figure will stand in, and that it is an assumption.
      expect(warning.message).toContain('600,000 EGP');
      expect(warning.message).toContain('(annual limit)');
    }
  });

  it('says so when there is no annual limit to fall back on either', () => {
    const [warning] = importReviewWarnings({ ...draft, annualLimit: null });
    expect(warning?.message).toContain('no annual limit');
    expect(warning?.blocksPublish).toBe(true);
  });

  it('publishes only once every flagged area is confirmed', () => {
    const warnings = importReviewWarnings(draft);
    expect(readyToPublish(warnings, new Set())).toBe(false);

    const twoOfThree = new Set(warnings.slice(0, 2).map(reviewWarningKey));
    expect(readyToPublish(warnings, twoOfThree)).toBe(false);

    const all = new Set(warnings.map(reviewWarningKey));
    expect(readyToPublish(warnings, all)).toBe(true);

    // A plan with nothing unstated has nothing to confirm.
    expect(readyToPublish([], new Set())).toBe(true);
  });
});
