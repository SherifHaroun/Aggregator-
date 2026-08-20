/**
 * Business-rule and dynamic-field checks that need no database.
 *
 * No insurance data is created here. The option definitions below are invented
 * inside the test to prove the system works for benefits nobody anticipated —
 * they are never written anywhere.
 */

import {
  CUSTOMER_TYPES,
  SME_FIXED_AVERAGE_AGE,
  resolveAverageAgeForCustomerType,
  usesAgeRange,
  usesFixedAverageAge,
} from '@aggregator/shared';
import type { OptionField, PlanConfiguration } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toPlanConfigurationDto } from '../src/modules/plan-configurations/plan-configurations.mapper.js';
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

/** Minimal stand-in for a persisted configuration row. */
function configurationRow(overrides: Partial<PlanConfiguration> = {}): PlanConfiguration {
  return {
    id: 'cfg',
    planId: 'plan',
    customerType: 'SME',
    geographicalCoverage: 'LOCAL',
    currency: null,
    annualPrice: null,
    annualLimit: null,
    deductible: null,
    coPayment: null,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as PlanConfiguration;
}

describe('configuration responses carry the resolved age', () => {
  it('derives the SME average age instead of storing it', () => {
    const dto = toPlanConfigurationDto(configurationRow({ customerType: 'SME' }));
    expect(dto.averageAge.value).toBe(SME_FIXED_AVERAGE_AGE);
    expect(dto.averageAge.label).toBe(`Average age: ${SME_FIXED_AVERAGE_AGE}`);
  });

  it('reports no age for an individual configuration', () => {
    const dto = toPlanConfigurationDto(configurationRow({ customerType: 'INDIVIDUAL' }));
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
