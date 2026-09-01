/**
 * A company's provider networks, against a real PostgreSQL database.
 *
 * The two rules that matter are ownership and order.
 *
 * OWNERSHIP: one insurer's network estate is not another's. "Tier 4" at one
 * company has nothing to do with "Tier 4" at the next, so a company's list must
 * never contain a network it does not sell, and a plan must never be recorded
 * as sold on another company's network. That is not a tidiness rule — it is a
 * false statement about what a customer would get.
 *
 * ORDER: the ranking is the company's own judgement of its networks, and it is
 * stored on the network row rather than derived, so re-ranking changes how the
 * list reads and changes nothing about which network any plan named.
 *
 * OPT-IN, like the other database suites: runs only when `TEST_DATABASE_URL` is
 * set. Every record is namespaced and removed afterwards — test fixtures, not
 * seed data.
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createMedicalNetwork,
  deleteMedicalNetwork,
  listMedicalNetworks,
  reorderMedicalNetworks,
  updateMedicalNetwork,
} from '../src/modules/companies/medical-networks.service.js';
import {
  createPlanConfiguration,
  updatePlanConfiguration,
} from '../src/modules/plan-configurations/plan-configurations.service.js';
import { createPlan } from '../src/modules/plans/plans.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_networks_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

/** Two companies, so "belongs to this one" is a claim with something to fail against. */
async function givenTwoCompanies() {
  const [a, b] = await Promise.all([
    db().company.create({ data: { name: `${PREFIX}_company_a` } }),
    db().company.create({ data: { name: `${PREFIX}_company_b` } }),
  ]);
  return { a: a.id, b: b.id };
}

async function cleanup(): Promise<void> {
  if (!prisma) return;
  await prisma.plan.deleteMany({ where: { name: { startsWith: PREFIX } } });
  // Networks cascade with their company.
  await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

describe.skipIf(!url)('a company’s medical networks', () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect();
  });

  it('never shows one company the networks of another', async () => {
    const { a, b } = await givenTwoCompanies();

    await createMedicalNetwork(a, { name: 'Golden Care Network' });
    await createMedicalNetwork(a, { name: 'Silver Care Network' });
    await createMedicalNetwork(b, { name: 'Tier 4' });

    const forA = await listMedicalNetworks(a);
    const forB = await listMedicalNetworks(b);

    expect(forA.map((network) => network.name)).toEqual([
      'Golden Care Network',
      'Silver Care Network',
    ]);
    expect(forB.map((network) => network.name)).toEqual(['Tier 4']);

    // Nothing of A's appears in B's list, and every row names its own owner.
    expect(forB.some((network) => network.name.includes('Care'))).toBe(false);
    expect(forA.every((network) => network.companyId === a)).toBe(true);
    expect(forB.every((network) => network.companyId === b)).toBe(true);
  });

  it('lets two companies use the SAME network name without collision', async () => {
    const { a, b } = await givenTwoCompanies();

    // Uniqueness is per company: one insurer's "Full Network" is not another's.
    const ofA = await createMedicalNetwork(a, { name: 'Full Network' });
    const ofB = await createMedicalNetwork(b, { name: 'Full Network' });

    expect(ofA.id).not.toBe(ofB.id);
    expect(await listMedicalNetworks(a)).toHaveLength(1);
    expect(await listMedicalNetworks(b)).toHaveLength(1);
  });

  it('refuses a second network of the same name within one company', async () => {
    const { a } = await givenTwoCompanies();
    await createMedicalNetwork(a, { name: 'Golden Care Network' });

    await expect(
      createMedicalNetwork(a, { name: 'golden care network' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses to reorder using a network belonging to another company', async () => {
    const { a, b } = await givenTwoCompanies();
    const ofA = await createMedicalNetwork(a, { name: 'Golden Care Network' });
    const ofB = await createMedicalNetwork(b, { name: 'Tier 4' });

    await expect(reorderMedicalNetworks(a, [ofB.id, ofA.id])).rejects.toMatchObject({
      status: 400,
    });

    // And A's own order is untouched by the attempt.
    expect((await listMedicalNetworks(a)).map((n) => n.name)).toEqual(['Golden Care Network']);
  });


/**
 * A plan and one priced variant of it.
 *
 * The variant is where a network is chosen now, so every test below needs both.
 */
async function givenPlanOn(companyId: string, medicalNetworkId: string | null) {
  const tag = `${PREFIX}_${unique()}`;
  const plan = await createPlan({
    companyId,
    customerType: 'INDIVIDUAL',
    name: tag,
    code: tag,
  });
  const variant = await createPlanConfiguration({
    planId: plan.id,
    geographicalCoverage: 'LOCAL',
    medicalNetworkId,
  });
  return { planId: plan.id, variantId: variant.id };
}

let counter = 0;
function unique() {
  counter += 1;
  return String(counter);
}

  it('refuses to sell a variant on another company’s network', async () => {
    const { a, b } = await givenTwoCompanies();
    const ofB = await createMedicalNetwork(b, { name: 'Tier 4' });

    await expect(givenPlanOn(a, ofB.id)).rejects.toMatchObject({ status: 400 });
  });

  it('sells one plan on two networks, as two variants', async () => {
    // The whole reason the network sits on the variant: "Gold on the full
    // network" and "Gold on the limited one" are one product sold two ways.
    const { a } = await givenTwoCompanies();
    const full = await createMedicalNetwork(a, { name: 'Full Network' });
    const limited = await createMedicalNetwork(a, { name: 'Limited Network' });

    const { planId } = await givenPlanOn(a, full.id);
    const second = await createPlanConfiguration({
      planId,
      geographicalCoverage: 'LOCAL',
      medicalNetworkId: limited.id,
    });

    expect(second.medicalNetworkId).toBe(limited.id);
    expect(await db().planConfiguration.count({ where: { planId } })).toBe(2);
  });

  it('ranks the list, and re-ranking changes no plan’s answer', async () => {
    const { a } = await givenTwoCompanies();

    // Added at the bottom in turn, so creation order IS the starting ranking.
    const golden = await createMedicalNetwork(a, { name: 'Golden Care Network' });
    const silver = await createMedicalNetwork(a, { name: 'Silver Care Network' });
    const basic = await createMedicalNetwork(a, { name: 'Basic Network' });

    expect((await listMedicalNetworks(a)).map((n) => n.name)).toEqual([
      'Golden Care Network',
      'Silver Care Network',
      'Basic Network',
    ]);
    const { variantId } = await givenPlanOn(a, silver.id);

    // The company decides Basic outranks Silver after all.
    await reorderMedicalNetworks(a, [golden.id, basic.id, silver.id]);

    const ranked = await listMedicalNetworks(a);
    expect(ranked.map((n) => n.name)).toEqual([
      'Golden Care Network',
      'Basic Network',
      'Silver Care Network',
    ]);
    // Positions are renumbered contiguously from the top.
    expect(ranked.map((n) => n.sortOrder)).toEqual([0, 1, 2]);

    /**
     * The variant still names the SAME network. Re-ranking says how good a
     * network is thought to be; it never rewrites what a variant is sold on.
     */
    const after = await db().planConfiguration.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.medicalNetworkId).toBe(silver.id);
  });

  it('renames in place, so every plan sold on it follows', async () => {
    const { a } = await givenTwoCompanies();
    const network = await createMedicalNetwork(a, { name: 'Golden Care Netwrok' });
    const { variantId } = await givenPlanOn(a, network.id);

    await updateMedicalNetwork(network.id, { name: 'Golden Care Network' });

    // A variant points at the row, never at its wording.
    const after = await db().planConfiguration.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.medicalNetworkId).toBe(network.id);
    expect((await listMedicalNetworks(a))[0]!.name).toBe('Golden Care Network');
  });

  it('will not quietly delete a network variants are sold on', async () => {
    const { a } = await givenTwoCompanies();
    const network = await createMedicalNetwork(a, { name: 'Golden Care Network' });
    const { variantId } = await givenPlanOn(a, network.id);

    await expect(deleteMedicalNetwork(network.id)).rejects.toMatchObject({ status: 409 });

    // Forced, the variant survives and simply stops naming a network.
    await deleteMedicalNetwork(network.id, { force: true });
    const after = await db().planConfiguration.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.medicalNetworkId).toBeNull();
  });

  it('clears the reference when a variant is moved off a network', async () => {
    const { a } = await givenTwoCompanies();
    const network = await createMedicalNetwork(a, { name: 'Golden Care Network' });
    const { variantId } = await givenPlanOn(a, network.id);

    // Null is a real answer: the document does not say which network.
    const updated = await updatePlanConfiguration(variantId, { medicalNetworkId: null });
    expect(updated.medicalNetworkId).toBeNull();
  });
});
