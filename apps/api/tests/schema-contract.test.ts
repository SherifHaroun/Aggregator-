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
    expect(
      enums
        .get('CustomerType')
        ?.values.map((v) => v.name)
        .sort(),
    ).toEqual([...CUSTOMER_TYPE_IDS].sort());
    expect(
      enums
        .get('GeographicalCoverage')
        ?.values.map((v) => v.name)
        .sort(),
    ).toEqual([...GEOGRAPHICAL_COVERAGE_IDS].sort());
  });

  it('contain no COUPLE customer type', () => {
    expect(enums.get('CustomerType')?.values.map((v) => v.name)).not.toContain('COUPLE');
  });

  it('carry every coverage scope the shared configuration declares', () => {
    // The list grows: insurers sell wider scopes than Local and International,
    // and the enum is what stops an invented spelling reaching the comparison.
    // Parity with @aggregator/shared is enforced at compile time by
    // `src/lib/enum-parity.ts`; this checks the migration kept up.
    const values = enums.get('GeographicalCoverage')?.values.map((v) => v.name) ?? [];
    expect(values).toEqual(expect.arrayContaining([...GEOGRAPHICAL_COVERAGE_IDS]));
    expect(values).toHaveLength(GEOGRAPHICAL_COVERAGE_IDS.length);
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

  it('is unique on everything that makes one variant different from another', () => {
    // A variant is the plan plus what changes its price — who it is for, where
    // it covers, the network, the room and the ceiling — then the age band. All
    // of it, because the same plan really is sold on two networks at two prices.
    expect(uniqueSets('PlanConfiguration')).toContain(
      [
        'planId',
        'customerType',
        'geographicalCoverage',
        'medicalNetworkId',
        'roomType',
        'annualLimit',
        'ageFrom',
        'ageTo',
      ]
        .sort()
        .join('+'),
    );
  });

  it('puts the medical network on the variant, never on the plan', () => {
    // On the plan it forced "Gold (Full Network)" and "Gold (limited Network)"
    // to be two products. They are one product sold two ways.
    expect(fieldNames('Plan')).not.toContain('medicalNetworkId');
    expect(fieldNames('PlanConfiguration')).toContain('medicalNetworkId');
    expect(fieldNames('PlanConfiguration')).toContain('roomType');
  });

  it('keeps a provider estate on the network, as rows', () => {
    // Entered once per network and read by every variant sold on it — never
    // re-typed per plan, and never ten columns that cannot grow an eleventh.
    const provider = fieldNames('NetworkProvider');
    expect(provider).toContain('networkId');
    expect(provider).toContain('category');
    expect(uniqueSets('NetworkProvider')).toContain(['networkId', 'category'].sort().join('+'));
    // Neither a figure nor wording is required: documents give one, the other,
    // or both.
    const model_ = model('NetworkProvider').fields;
    expect(model_.find((f) => f.name === 'count')?.isRequired).toBe(false);
    expect(model_.find((f) => f.name === 'detail')?.isRequired).toBe(false);
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

describe('a benefit may group other benefits', () => {
  it('models the group as a self-relation, not a second table of benefits', () => {
    const option = model('InsuranceOption');
    const parent = option.fields.find((field) => field.name === 'parent');
    const children = option.fields.find((field) => field.name === 'children');

    expect(option.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining(['isUmbrella', 'parentId']),
    );
    expect(parent?.type).toBe('InsuranceOption');
    expect(children?.type).toBe('InsuranceOption');
    expect(children?.isList).toBe(true);
  });

  it('keeps a sub-benefit an ordinary benefit, valued per configuration', () => {
    // A sub-benefit is attached and valued exactly like any other benefit:
    // nothing about the hierarchy reaches the value tables.
    expect(fieldNames('PlanOption')).not.toContain('parentId');
    expect(fieldNames('PlanOptionValue')).not.toContain('parentId');
  });

  it('refuses in SQL to let a benefit be its own parent', () => {
    const sql = readdirSync(join(import.meta.dirname, '..', 'prisma', 'migrations'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFileSync(join(entry.parentPath, entry.name, 'migration.sql'), 'utf8'))
      .join('\n');
    expect(sql).toMatch(/insurance_options_parent_not_self_check/);
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

  /**
   * A migration may MOVE data that employees entered; it may never INVENT any.
   *
   * The rule being protected is "the database starts empty" — no benefit, no
   * company and no limitation ships in the code. Reshaping records that already
   * exist is a different act: when the answer list moved from the benefit down
   * to the setting, every recorded condition had to travel with it, or plans
   * would have silently started reading as unrestricted.
   *
   * `INSERT ... SELECT` can only copy rows that are already there, so it is
   * allowed. `INSERT ... VALUES` conjures rows from the migration file itself,
   * which is exactly what seeding is, so it stays banned.
   */
  it('invents no data — migrations may move records, never author them', () => {
    for (const name of dirs) {
      const sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
      const inserts = sql.match(/^\s*INSERT\s+INTO[\s\S]*?;/gim) ?? [];

      for (const statement of inserts) {
        expect(
          /\bSELECT\b/i.test(statement),
          `${name} writes rows with literal VALUES, which is seed data:\n${statement.slice(0, 200)}`,
        ).toBe(true);
        expect(/\bVALUES\s*\(/i.test(statement)).toBe(false);
      }
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
