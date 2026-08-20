/**
 * Structural checks on the database design, run WITHOUT a database.
 *
 * These read Prisma's generated datamodel and the migration SQL, so they catch
 * a regression in the architecture (a benefit becoming a column, option values
 * drifting back up to the plan, the uniqueness rule disappearing) even on a
 * machine with no PostgreSQL.
 */

import { CUSTOMER_TYPE_IDS, GEOGRAPHICAL_COVERAGE_IDS } from '@aggregator/shared';
import { Prisma } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map((item) => [item.name, item]));

function model(name: string) {
  const found = models.get(name);
  if (!found) throw new Error(`Model ${name} is missing from the schema.`);
  return found;
}

const fieldNames = (name: string) => model(name).fields.map((field) => field.name);

/** Composite `@@unique` sets, normalised to a comparable "a+b+c" string. */
const uniqueSets = (name: string) =>
  model(name).uniqueFields.map((fields) => [...fields].sort().join('+'));

describe('customer type and geographical coverage', () => {
  it('are Prisma enums matching the centralized business configuration', () => {
    expect(enums.get('CustomerType')?.values.map((v) => v.name).sort()).toEqual(
      [...CUSTOMER_TYPE_IDS].sort(),
    );
    expect(enums.get('GeographicalCoverage')?.values.map((v) => v.name).sort()).toEqual(
      [...GEOGRAPHICAL_COVERAGE_IDS].sort(),
    );
  });

  it('contain no COUPLE customer type', () => {
    expect(enums.get('CustomerType')?.values.map((v) => v.name)).not.toContain('COUPLE');
  });

  it('use Local/International wording, not Egypt Only/Worldwide', () => {
    const values = enums.get('GeographicalCoverage')?.values.map((v) => v.name) ?? [];
    expect(values).toEqual(expect.arrayContaining(['LOCAL', 'INTERNATIONAL']));
    expect(values).toHaveLength(2);
  });
});

describe('Plan vs PlanConfiguration', () => {
  it('keeps configuration-specific pricing off the Plan', () => {
    const plan = fieldNames('Plan');
    for (const field of ['annualPrice', 'annualLimit', 'deductible', 'coPayment', 'currency']) {
      expect(plan).not.toContain(field);
    }
  });

  it('puts pricing on the configuration', () => {
    const configuration = fieldNames('PlanConfiguration');
    for (const field of ['annualPrice', 'annualLimit', 'deductible', 'coPayment', 'currency']) {
      expect(configuration).toContain(field);
    }
  });

  it('lets one plan hold many configurations', () => {
    const relation = model('Plan').fields.find((field) => field.name === 'configurations');
    expect(relation?.isList).toBe(true);
    expect(relation?.type).toBe('PlanConfiguration');
  });

  it('is unique on plan + customer type + coverage + age band', () => {
    // The age band is part of the identity, so one plan can price 18-40 and
    // 41-60 separately for the same customer type and coverage area.
    expect(uniqueSets('PlanConfiguration')).toContain(
      ['planId', 'customerType', 'geographicalCoverage', 'ageFrom', 'ageTo'].sort().join('+'),
    );
  });

  it('requires an age band on the configuration', () => {
    // The admin side of the age match. The customer's own age stays a single
    // number they type on the comparison screen, never stored here.
    const fields = model('PlanConfiguration').fields;
    for (const name of ['ageFrom', 'ageTo']) {
      const field = fields.find((item) => item.name === name);
      expect(field, `${name} should exist`).toBeDefined();
      expect(field?.type).toBe('Int');
      expect(field?.isRequired).toBe(true);
    }
  });
});

describe('options belong to a configuration, not a plan', () => {
  it('attaches PlanOption to PlanConfiguration', () => {
    const planOption = fieldNames('PlanOption');
    expect(planOption).toContain('planConfigurationId');
    expect(planOption).not.toContain('planId');
  });

  it('allows an option at most once per configuration', () => {
    expect(uniqueSets('PlanOption')).toContain(
      ['planConfigurationId', 'optionId'].sort().join('+'),
    );
  });

  it('keeps values keyed to the plan option, so configurations cannot share them', () => {
    const value = fieldNames('PlanOptionValue');
    expect(value).toContain('planOptionId');
    expect(value).toContain('optionFieldId');
    expect(uniqueSets('PlanOptionValue')).toContain(
      ['planOptionId', 'optionFieldId'].sort().join('+'),
    );
  });
});

describe('no benefit is ever a column', () => {
  const forbidden = [
    'dentalCare',
    'opticalCare',
    'maternity',
    'mentalHealth',
    'outpatientCare',
    'inpatientCare',
    'physiotherapy',
    'telemedicine',
  ];

  it('has no benefit-named field on any model', () => {
    for (const item of Prisma.dmmf.datamodel.models) {
      for (const field of item.fields) {
        for (const name of forbidden) {
          expect(field.name.toLowerCase()).not.toBe(name.toLowerCase());
        }
      }
    }
  });

  it('represents benefits as records with self-described fields', () => {
    expect(fieldNames('InsuranceOption')).toContain('fields');
    expect(fieldNames('OptionField')).toEqual(expect.arrayContaining(['label', 'key', 'dataType']));
  });
});

describe('migrations', () => {
  const migrationsDir = join(import.meta.dirname, '..', 'prisma', 'migrations');
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it('includes the PlanConfiguration migration', () => {
    expect(dirs.some((name) => name.includes('plan_configurations'))).toBe(true);
  });

  it('creates the uniqueness constraint in SQL', () => {
    const sql = dirs
      .map((name) => readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'))
      .join('\n');
    expect(sql).toMatch(/CREATE UNIQUE INDEX .*plan_configurations.*/);
    expect(sql).toMatch(/"planId", "customerType", "geographicalCoverage"/);
  });

  it('contains no INSERT statements — the database starts empty', () => {
    for (const name of dirs) {
      const sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
      expect(sql).not.toMatch(/^\s*INSERT\s+INTO/im);
    }
  });
});

describe('no seed data', () => {
  it('declares no Prisma seed script', () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as { prisma?: { seed?: string }; scripts?: Record<string, string> };
    expect(pkg.prisma?.seed).toBeUndefined();
    expect(Object.keys(pkg.scripts ?? {})).not.toContain('seed');
  });

  it('ships no seed file', () => {
    const prismaDir = readdirSync(join(import.meta.dirname, '..', 'prisma'));
    expect(prismaDir.filter((name) => /^seed\./.test(name))).toEqual([]);
  });
});
