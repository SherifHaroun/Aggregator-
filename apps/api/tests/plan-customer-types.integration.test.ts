/**
 * ONE COMPANY, ONE PLAN NAME, THREE PRODUCTS.
 *
 * A company sells "Platinum" to individuals, to families and to SMEs. They
 * share a name and nothing else: different cover, different networks, different
 * prices, and a customer must never be shown the wrong one. This suite is the
 * proof that they are three separate records all the way down.
 *
 * OPT-IN, like the other database suites: runs only when `TEST_DATABASE_URL` is
 * set. Every record is namespaced and removed afterwards — test fixtures, not
 * seed data.
 */

import { derivePlanCode, type CustomerTypeId } from '@aggregator/shared';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runComparison } from '../src/modules/comparison/comparison.service.js';
import { createPlanConfiguration } from '../src/modules/plan-configurations/plan-configurations.service.js';
import { createPlan, deletePlan, updatePlan } from '../src/modules/plans/plans.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_ct_${Date.now()}`;
const PLAN_NAME = `${PREFIX} Platinum`;

const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

const ids = { company: '', insuranceType: '' };
/** The three Platinum plans, by the buyer each is sold to. */
const plans: Partial<Record<CustomerTypeId, string>> = {};

const BUYERS = ['INDIVIDUAL', 'FAMILY', 'SME'] as const;

/** What each buyer's Platinum is worth — deliberately all different. */
const TERMS = {
  INDIVIDUAL: { coverage: 'LOCAL', limit: 200000, price: 6187 },
  FAMILY: { coverage: 'INTERNATIONAL', limit: 500000, price: 11071 },
  SME: { coverage: 'WORLDWIDE', limit: 1000000, price: 16288 },
} as const;

describe.skipIf(!url)('one plan name, three customer types', () => {
  beforeAll(async () => {
    const company = await db().company.create({ data: { name: `${PREFIX}_company` } });
    ids.company = company.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.plan.deleteMany({ where: { companyId: ids.company } });
    await prisma.company.deleteMany({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  it('creates the same plan name under all three buyers', async () => {
    for (const customerType of BUYERS) {
      const plan = await createPlan({
        companyId: ids.company,
        customerType,
        name: PLAN_NAME,
        code: derivePlanCode(PLAN_NAME, customerType),
      });
      plans[customerType] = plan.id;
    }

    const stored = await db().plan.findMany({
      where: { companyId: ids.company },
      orderBy: { customerType: 'asc' },
    });

    expect(stored).toHaveLength(3);
    // The DISPLAYED name is identical for all three — that is the point.
    expect(new Set(stored.map((plan) => plan.name))).toEqual(new Set([PLAN_NAME]));
    // The database identities are not.
    expect(new Set(stored.map((plan) => plan.id)).size).toBe(3);
    expect(new Set(stored.map((plan) => plan.code)).size).toBe(3);
    expect(new Set(stored.map((plan) => plan.customerType))).toEqual(new Set(BUYERS));
  });

  it('keeps the buyer out of the displayed name and inside the code', async () => {
    const individual = await db().plan.findUniqueOrThrow({
      where: { id: plans.INDIVIDUAL! },
    });
    // What the employee reads.
    expect(individual.name).toBe(PLAN_NAME);
    expect(individual.name).not.toContain('INDIVIDUAL');
    // What the database keys on. Internal, never shown.
    expect(individual.code.endsWith('-INDIVIDUAL')).toBe(true);
  });

  it('rejects the same name for the SAME buyer', async () => {
    await expect(
      createPlan({
        companyId: ids.company,
        customerType: 'INDIVIDUAL',
        name: PLAN_NAME,
        // A code of the employee's own, so the unique index cannot be what
        // refuses it — the service has to.
        code: `${PREFIX}-PLAT-2`,
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(await db().plan.count({ where: { companyId: ids.company } })).toBe(3);
  });

  it('gives each one its own variants, benefits and prices', async () => {
    for (const customerType of BUYERS) {
      const terms = TERMS[customerType];
      const variant = await createPlanConfiguration({
        planId: plans[customerType]!,
        geographicalCoverage: terms.coverage,
        annualLimit: terms.limit,
        currency: 'EGP',
        priceBands: [{ ageFrom: 18, ageTo: 64, annualPrice: terms.price }],
      });
      expect(variant.planId).toBe(plans[customerType]);
    }

    for (const customerType of BUYERS) {
      const variants = await db().planConfiguration.findMany({
        where: { planId: plans[customerType]! },
        include: { priceBands: true },
      });
      expect(variants).toHaveLength(1);
      expect(variants[0]?.geographicalCoverage).toBe(TERMS[customerType].coverage);
      expect(variants[0]?.annualLimit?.toNumber()).toBe(TERMS[customerType].limit);
      expect(variants[0]?.priceBands[0]?.annualPrice?.toNumber()).toBe(TERMS[customerType].price);
    }
  });

  it('edits one without touching the others', async () => {
    await updatePlan(plans.INDIVIDUAL!, { name: `${PREFIX} Platinum Renamed` });

    const [individual, family, sme] = await Promise.all(
      BUYERS.map((customerType) =>
        db().plan.findUniqueOrThrow({ where: { id: plans[customerType]! } }),
      ),
    );

    expect(individual!.name).toBe(`${PREFIX} Platinum Renamed`);
    // The other two are untouched — same name, same code, same everything.
    expect(family!.name).toBe(PLAN_NAME);
    expect(sme!.name).toBe(PLAN_NAME);

    // ...and their variants stayed with them.
    expect(
      await db().planConfiguration.count({ where: { planId: plans.FAMILY! } }),
    ).toBe(1);

    await updatePlan(plans.INDIVIDUAL!, { name: PLAN_NAME });
  });

  it('deletes one without touching the others', async () => {
    const doomed = await createPlan({
      companyId: ids.company,
      customerType: 'SME',
      name: `${PREFIX} Disposable`,
      code: derivePlanCode(`${PREFIX} Disposable`, 'SME'),
    });
    await createPlanConfiguration({
      planId: doomed.id,
      geographicalCoverage: 'LOCAL',
      currency: 'EGP',
      priceBands: [{ ageFrom: 18, ageTo: 64, annualPrice: 100 }],
    });

    await deletePlan(doomed.id);

    // The plan and its variant are gone; the three Platinums are not.
    expect(await db().plan.count({ where: { id: doomed.id } })).toBe(0);
    expect(await db().planConfiguration.count({ where: { planId: doomed.id } })).toBe(0);
    expect(await db().plan.count({ where: { companyId: ids.company } })).toBe(3);
    for (const customerType of BUYERS) {
      expect(
        await db().planConfiguration.count({ where: { planId: plans[customerType]! } }),
      ).toBe(1);
    }
  });

  it('never lets a comparison cross from one buyer to another', async () => {
    /**
     * The three Platinums differ by coverage as well as by buyer, so a leak
     * would be visible twice over. The comparison is asked for an individual
     * covered locally: the family and SME plans must not appear, whatever
     * their name says.
     */
    for (const customerType of BUYERS) {
      const result = await runComparison({
        customerTypeId: customerType,
        geographicalCoverageId: TERMS[customerType].coverage,
        currency: 'EGP',
        ageFrom: 32,
        ageTo: 32,
      });

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0]?.planId).toBe(plans[customerType]);
      expect(result.plans[0]?.annualPrice).toBe(TERMS[customerType].price);
    }

    /**
     * And the same buyer asked about the WRONG area gets nothing rather than
     * another buyer's plan that happens to cover it.
     */
    const crossed = await runComparison({
      customerTypeId: 'INDIVIDUAL',
      geographicalCoverageId: 'INTERNATIONAL',
      currency: 'EGP',
      ageFrom: 32,
      ageTo: 32,
    });
    expect(crossed.plans).toHaveLength(0);
  });

  it('matches the age band, not merely the plan', async () => {
    // The bands run 18-64; a child falls outside every one of them.
    const child = await runComparison({
      customerTypeId: 'INDIVIDUAL',
      geographicalCoverageId: 'LOCAL',
      currency: 'EGP',
      ageFrom: 5,
      ageTo: 5,
    });
    expect(child.plans).toHaveLength(0);
  });
});
