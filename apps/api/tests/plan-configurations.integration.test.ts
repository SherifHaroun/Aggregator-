/**
 * End-to-end checks of the PlanConfiguration architecture against a real
 * PostgreSQL database.
 *
 * OPT-IN. Runs only when `TEST_DATABASE_URL` is set, so it can never touch the
 * development database by accident:
 *
 *   TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/aggregator_test" \
 *     npm run test -w @aggregator/api
 *
 * The target database must already have the migrations applied:
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
 *
 * Every record created here is namespaced with a run-specific prefix and
 * removed in `afterAll`. This is test fixture data, not seed data — nothing is
 * written to the development database and no seed script exists.
 */

import { SME_FIXED_AVERAGE_AGE } from '@aggregator/shared';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_${Date.now()}`;
const ids = { company: '', insuranceType: '', plan: '', option: '', coverageField: '' };

const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

describe.skipIf(!url)('PlanConfiguration architecture', () => {
  beforeAll(async () => {
    const company = await db().company.create({ data: { name: `${PREFIX}_company` } });
    const insuranceType = await db().insuranceType.create({
      data: { name: `${PREFIX}_type`, code: `${PREFIX}_type` },
    });
    const plan = await db().plan.create({
      data: {
        companyId: company.id,
        insuranceTypeId: insuranceType.id,
        name: `${PREFIX}_plan`,
        code: `${PREFIX}_plan`,
      },
    });
    // An option invented here, exactly as an employee would create one.
    const option = await db().insuranceOption.create({
      data: {
        insuranceTypeId: insuranceType.id,
        name: `${PREFIX}_option`,
        fields: {
          create: [
            { label: 'Coverage Percentage', key: 'coverage_percentage', dataType: 'PERCENTAGE' },
            { label: 'Annual Limit', key: 'annual_limit', dataType: 'CURRENCY', sortOrder: 1 },
          ],
        },
      },
      include: { fields: true },
    });

    ids.company = company.id;
    ids.insuranceType = insuranceType.id;
    ids.plan = plan.id;
    ids.option = option.id;
    ids.coverageField = option.fields.find((f) => f.key === 'coverage_percentage')!.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Deleting the plan cascades configurations -> plan options -> values.
    await prisma.plan.deleteMany({ where: { id: ids.plan } });
    await prisma.insuranceOption.deleteMany({ where: { id: ids.option } });
    await prisma.insuranceType.deleteMany({ where: { id: ids.insuranceType } });
    await prisma.company.deleteMany({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  // (1) and (2)
  it('lets one plan hold all six customer-type / coverage configurations', async () => {
    const combinations = [
      { customerType: 'INDIVIDUAL', geographicalCoverage: 'LOCAL' },
      { customerType: 'INDIVIDUAL', geographicalCoverage: 'INTERNATIONAL' },
      { customerType: 'FAMILY', geographicalCoverage: 'LOCAL' },
      { customerType: 'FAMILY', geographicalCoverage: 'INTERNATIONAL' },
      { customerType: 'SME', geographicalCoverage: 'LOCAL' },
      { customerType: 'SME', geographicalCoverage: 'INTERNATIONAL' },
    ] as const;

    for (const [index, combination] of combinations.entries()) {
      await db().planConfiguration.create({
        data: { planId: ids.plan, ...combination, currency: 'EGP', annualPrice: 1000 * (index + 1) },
      });
    }

    const stored = await db().planConfiguration.count({ where: { planId: ids.plan } });
    expect(stored).toBe(6);

    // ...and they are configurations of ONE plan, not six plans.
    expect(await db().plan.count({ where: { name: `${PREFIX}_plan` } })).toBe(1);
  });

  // (3)
  it('allows different prices per configuration', async () => {
    const [individual, family] = await Promise.all([
      db().planConfiguration.findFirstOrThrow({
        where: { planId: ids.plan, customerType: 'INDIVIDUAL', geographicalCoverage: 'LOCAL' },
      }),
      db().planConfiguration.findFirstOrThrow({
        where: { planId: ids.plan, customerType: 'FAMILY', geographicalCoverage: 'LOCAL' },
      }),
    ]);
    expect(individual.annualPrice?.toNumber()).not.toBe(family.annualPrice?.toNumber());
  });

  // (4), (5) and (6)
  it('keeps option values isolated per configuration', async () => {
    const configurations = await db().planConfiguration.findMany({
      where: { planId: ids.plan, geographicalCoverage: 'LOCAL' },
      orderBy: { customerType: 'asc' },
    });

    // The SAME option attached to three configurations with different values.
    const coverageByCustomerType: Record<string, number> = {
      INDIVIDUAL: 80,
      FAMILY: 90,
      SME: 85,
    };

    for (const configuration of configurations) {
      await db().planOption.create({
        data: {
          planConfigurationId: configuration.id,
          optionId: ids.option,
          values: {
            create: [
              {
                optionFieldId: ids.coverageField,
                numberValue: coverageByCustomerType[configuration.customerType],
              },
            ],
          },
        },
      });
    }

    for (const configuration of configurations) {
      const values = await db().planOptionValue.findMany({
        where: { planOption: { planConfigurationId: configuration.id } },
      });
      expect(values).toHaveLength(1);
      expect(values[0]?.numberValue?.toNumber()).toBe(
        coverageByCustomerType[configuration.customerType],
      );
    }
  });

  // (7)
  it('accepts a completely new option with new fields, with no schema change', async () => {
    const invented = await db().insuranceOption.create({
      data: {
        insuranceTypeId: ids.insuranceType,
        name: `${PREFIX}_invented`,
        fields: {
          create: [
            { label: 'Maximum Sessions', key: 'maximum_sessions', dataType: 'NUMBER' },
            { label: 'Requires Referral', key: 'requires_referral', dataType: 'BOOLEAN' },
            { label: 'Notes', key: 'notes', dataType: 'TEXT' },
          ],
        },
      },
      include: { fields: true },
    });

    const configuration = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, customerType: 'SME', geographicalCoverage: 'LOCAL' },
    });

    const planOption = await db().planOption.create({
      data: {
        planConfigurationId: configuration.id,
        optionId: invented.id,
        sortOrder: 1,
        values: {
          create: invented.fields.map((f) => ({
            optionFieldId: f.id,
            ...(f.dataType === 'NUMBER' ? { numberValue: 12 } : {}),
            ...(f.dataType === 'BOOLEAN' ? { booleanValue: true } : {}),
            ...(f.dataType === 'TEXT' ? { textValue: 'Network clinics only' } : {}),
          })),
        },
      },
      include: { values: true },
    });

    expect(planOption.values).toHaveLength(3);
    await db().insuranceOption.delete({ where: { id: invented.id } }).catch(async () => {
      await db().planOption.delete({ where: { id: planOption.id } });
      await db().insuranceOption.delete({ where: { id: invented.id } });
    });
  });

  // (8)
  it('rejects a duplicate plan + customer type + coverage', async () => {
    await expect(
      db().planConfiguration.create({
        data: {
          planId: ids.plan,
          customerType: 'INDIVIDUAL',
          geographicalCoverage: 'LOCAL',
          annualPrice: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  // (9)
  it('stores no age column — SME uses the centralized rule', async () => {
    const configuration = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, customerType: 'SME', geographicalCoverage: 'LOCAL' },
    });
    expect(Object.keys(configuration)).not.toContain('averageAge');
    expect(SME_FIXED_AVERAGE_AGE).toBe(35);
  });

  // The query the comparison engine will run.
  it('finds every matching configuration across companies and plans', async () => {
    const matches = await db().planConfiguration.findMany({
      where: { customerType: 'INDIVIDUAL', geographicalCoverage: 'LOCAL', isActive: true },
      include: { plan: { include: { company: true } } },
    });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]?.plan.company.id).toBeTruthy();
  });
});

// (10)
describe('no seed data', () => {
  it.skipIf(!url)('finds no records outside this test run', async () => {
    const stray = await db().company.count({ where: { NOT: { name: { startsWith: 'test_' } } } });
    expect(stray).toBe(0);
  });
});
