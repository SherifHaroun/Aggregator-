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
import { createPlanConfiguration } from '../src/modules/plan-configurations/plan-configurations.service.js';

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
    const plan = await db().plan.create({
      data: {
        companyId: company.id,
        customerType: 'INDIVIDUAL',
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
    ids.plan = plan.id;
    ids.option = option.id;
    ids.coverageField = option.fields.find((f) => f.key === 'coverage_percentage')!.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Deleting the plan cascades configurations -> plan options -> values.
    // Deleting the plans cascades variants -> price bands, options and values.
    await prisma.plan.deleteMany({ where: { companyId: ids.company } });
    await prisma.insuranceOption.deleteMany({ where: { id: ids.option } });
    await prisma.company.deleteMany({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  // (1) and (2)
  it('keeps a company three customer types in separate plans of the same name', async () => {
    /**
     * Individual, Family and SME are separate PRODUCTS that merely share a
     * name. They are three plan records, never one plan with three sections,
     * because somebody managing the family book should not be able to reach
     * the individual one — and the comparison filters on this column.
     */
    for (const customerType of ['FAMILY', 'SME'] as const) {
      await db().plan.create({
        data: {
          companyId: ids.company,
          customerType,
          name: `${PREFIX}_plan`,
          code: `${PREFIX}_plan_${customerType.toLowerCase()}`,
        },
      });
    }

    const sameName = await db().plan.findMany({
      where: { companyId: ids.company, name: `${PREFIX}_plan` },
    });
    expect(sameName).toHaveLength(3);
    // One record per buyer, and each names exactly one.
    expect(new Set(sameName.map((plan) => plan.customerType)).size).toBe(3);
  });

  it('lets one plan hold a variant per coverage scope', async () => {
    for (const geographicalCoverage of ['LOCAL', 'INTERNATIONAL'] as const) {
      await db().planConfiguration.create({
        data: { planId: ids.plan, geographicalCoverage, currency: 'EGP' },
      });
    }

    const variants = await db().planConfiguration.count({ where: { planId: ids.plan } });
    expect(variants).toBe(2);
    // ...and they are variants of ONE plan, not two plans.
    expect(await db().plan.count({ where: { id: ids.plan } })).toBe(1);
  });

  // (3) The point of the whole model.
  it('prices a variant band by band without duplicating its benefits', async () => {
    const variant = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, geographicalCoverage: 'LOCAL' },
    });

    await db().planOption.create({
      data: {
        planConfigurationId: variant.id,
        optionId: ids.option,
        values: { create: [{ optionFieldId: ids.coverageField, numberValue: 80 }] },
      },
    });

    await db().planPriceBand.createMany({
      data: [
        { variantId: variant.id, ageFrom: 0, ageTo: 17, annualPrice: 3681 },
        { variantId: variant.id, ageFrom: 18, ageTo: 24, annualPrice: 5701 },
        { variantId: variant.id, ageFrom: 25, ageTo: 29, annualPrice: 7132 },
        // Named but not priced: the plan is not sold at this age.
        { variantId: variant.id, ageFrom: 65, ageTo: 75, annualPrice: null },
      ],
    });

    const bands = await db().planPriceBand.count({ where: { variantId: variant.id } });
    const attachments = await db().planOption.count({
      where: { planConfigurationId: variant.id },
    });

    expect(bands).toBe(4);
    // FOUR prices, ONE benefit. Under the old model this was four copies.
    expect(attachments).toBe(1);
    expect(
      await db().planOptionValue.count({
        where: { planOption: { planConfigurationId: variant.id } },
      }),
    ).toBe(1);
  });

  it('matches a customer to the band their age falls into', async () => {
    const variant = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, geographicalCoverage: 'LOCAL' },
    });

    // The band is found numerically, never by reading a label.
    const forTwentySix = await db().planPriceBand.findMany({
      where: { variantId: variant.id, ageFrom: { lte: 26 }, ageTo: { gte: 26 } },
    });
    expect(forTwentySix).toHaveLength(1);
    expect(forTwentySix[0]?.annualPrice?.toNumber()).toBe(7132);

    // A band with no premium is not sellable — an absence, not a free plan.
    const sellableAtSeventy = await db().planPriceBand.count({
      where: {
        variantId: variant.id,
        ageFrom: { lte: 70 },
        ageTo: { gte: 70 },
        annualPrice: { not: null },
      },
    });
    expect(sellableAtSeventy).toBe(0);
  });

  // (4), (5) and (6)
  it('keeps option values isolated per variant', async () => {
    const international = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, geographicalCoverage: 'INTERNATIONAL' },
    });
    await db().planOption.create({
      data: {
        planConfigurationId: international.id,
        optionId: ids.option,
        values: { create: [{ optionFieldId: ids.coverageField, numberValue: 90 }] },
      },
    });

    const byCoverage = await db().planConfiguration.findMany({
      where: { planId: ids.plan },
      include: { options: { include: { values: true } } },
      orderBy: { geographicalCoverage: 'asc' },
    });

    const values = byCoverage.map((variant) =>
      variant.options[0]?.values[0]?.numberValue?.toNumber(),
    );
    /**
     * The same benefit, two variants, two values. Neither can reach the other.
     *
     * LOCAL first because PostgreSQL orders an enum by the order its values
     * were DECLARED, not alphabetically — `GeographicalCoverage` starts at
     * LOCAL.
     */
    expect(values).toEqual([80, 90]);
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
      where: { planId: ids.plan, geographicalCoverage: 'LOCAL' },
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
    await db().planOption.delete({ where: { id: planOption.id } });
    await db().insuranceOption.delete({ where: { id: invented.id } });
  });

  // (8)
  it('rejects a second variant with the same coverage, network, room and ceiling', async () => {
    /**
     * Checked through the SERVICE, because the index alone cannot do it.
     *
     * PostgreSQL treats NULLs as distinct, so two variants that both leave the
     * network, room and ceiling unstated slip past a unique index every time.
     * They are the same offering entered twice, and the employee should be
     * told so rather than finding two identical rows later — which is why
     * `assertVariantIsDistinct` exists and why this asserts on it.
     */
    await expect(
      createPlanConfiguration({
        planId: ids.plan,
        geographicalCoverage: 'LOCAL',
        currency: 'EGP',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects the same age band twice within one variant', async () => {
    const variant = await db().planConfiguration.findFirstOrThrow({
      where: { planId: ids.plan, geographicalCoverage: 'LOCAL' },
    });
    await expect(
      db().planPriceBand.create({
        data: { variantId: variant.id, ageFrom: 18, ageTo: 24, annualPrice: 9999 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  // (9)
  it('stores no age column on the plan — SME uses the centralized rule', async () => {
    const plan = await db().plan.findFirstOrThrow({ where: { id: ids.plan } });
    expect(Object.keys(plan)).not.toContain('averageAge');
    expect(SME_FIXED_AVERAGE_AGE).toBe(35);
  });

  // The query the comparison engine will run.
  it('finds every matching variant across companies and plans', async () => {
    /**
     * Coverage is the variant's; the buyer is the PLAN's; the age is a band
     * underneath. All three narrow in one query, which is what the comparison
     * runs before it looks at a single benefit.
     */
    const matches = await db().planConfiguration.findMany({
      where: {
        geographicalCoverage: 'LOCAL',
        isActive: true,
        plan: { customerType: 'INDIVIDUAL', isActive: true },
        priceBands: {
          some: { ageFrom: { lte: 26 }, ageTo: { gte: 26 }, annualPrice: { not: null } },
        },
      },
      include: { plan: { include: { company: true } } },
    });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]?.plan.company.id).toBeTruthy();
    expect(matches[0]?.plan.customerType).toBe('INDIVIDUAL');
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
