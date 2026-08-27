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
    // A benefit invented here, exactly as an employee would create one. It is
    // global: it carries no company and no insurance type.
    const option = await db().insuranceOption.create({
      data: {
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
        data: {
          planId: ids.plan,
          ...combination,
          ageFrom: 18,
          ageTo: 60,
          currency: 'EGP',
          annualPrice: 1000 * (index + 1),
        },
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
    await db()
      .insuranceOption.delete({ where: { id: invented.id } })
      .catch(async () => {
        await db().planOption.delete({ where: { id: planOption.id } });
        await db().insuranceOption.delete({ where: { id: invented.id } });
      });
  });

  it('lets one plan price two age bands for the same customer type and coverage', async () => {
    // 18-40 and 41-60 are separate configurations of the same product.
    const older = await db().planConfiguration.create({
      data: {
        planId: ids.plan,
        customerType: 'INDIVIDUAL',
        geographicalCoverage: 'LOCAL',
        ageFrom: 61,
        ageTo: 75,
        currency: 'EGP',
        annualPrice: 9000,
      },
    });

    expect(older.ageFrom).toBe(61);
    expect(older.ageTo).toBe(75);

    // The band a given age falls into is found numerically, not by text.
    const forThirtyFive = await db().planConfiguration.findMany({
      where: { planId: ids.plan, ageFrom: { lte: 35 }, ageTo: { gte: 35 } },
    });
    expect(forThirtyFive.every((c) => c.ageFrom <= 35 && c.ageTo >= 35)).toBe(true);
    expect(forThirtyFive.map((c) => c.id)).not.toContain(older.id);

    await db().planConfiguration.delete({ where: { id: older.id } });
  });

  // (8)
  it('rejects a duplicate plan + customer type + coverage + age band', async () => {
    await expect(
      db().planConfiguration.create({
        data: {
          planId: ids.plan,
          customerType: 'INDIVIDUAL',
          geographicalCoverage: 'LOCAL',
          ageFrom: 18,
          ageTo: 60,
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

describe.skipIf(!url)('a benefit that groups other benefits', () => {
  const names = { group: `${PREFIX}_group`, child: `${PREFIX}_child` };

  afterAll(async () => {
    if (!prisma) return;
    // Children first: the parent cannot go while one still names it.
    await prisma.insuranceOption.deleteMany({ where: { name: names.child } });
    await prisma.insuranceOption.deleteMany({ where: { name: names.group } });
  });

  it('holds sub-benefits through a self-relation and keeps them valuable', async () => {
    // An umbrella carries no value of its own, so it is created with no fields.
    const group = await db().insuranceOption.create({
      data: { name: names.group, isUmbrella: true },
    });
    const child = await db().insuranceOption.create({
      data: {
        name: names.child,
        parentId: group.id,
        fields: { create: [{ label: 'Limit', key: 'limit', dataType: 'CURRENCY' }] },
      },
      include: { fields: true },
    });

    expect(await db().optionField.count({ where: { optionId: group.id } })).toBe(0);
    expect(child.parentId).toBe(group.id);
    // A sub-benefit is an ordinary benefit: it carries its own value.
    expect(child.fields).toHaveLength(1);
  });

  it('refuses to delete a group while a sub-benefit still names it', async () => {
    const group = await db().insuranceOption.findFirstOrThrow({ where: { name: names.group } });
    // The foreign key is ON DELETE RESTRICT, so the database itself refuses.
    await expect(db().insuranceOption.delete({ where: { id: group.id } })).rejects.toThrow();
    expect(await db().insuranceOption.count({ where: { id: group.id } })).toBe(1);
  });

  it('refuses a benefit that is its own parent', async () => {
    const child = await db().insuranceOption.findFirstOrThrow({ where: { name: names.child } });
    await expect(
      db().insuranceOption.update({ where: { id: child.id }, data: { parentId: child.id } }),
    ).rejects.toThrow();
  });
});

// (10)
describe('no seed data', () => {
  it.skipIf(!url)('finds no records outside this test run', async () => {
    const stray = await db().company.count({ where: { NOT: { name: { startsWith: 'test_' } } } });
    expect(stray).toBe(0);
  });
});
