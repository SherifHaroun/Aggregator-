/**
 * Customers and their carts, against a real PostgreSQL database.
 *
 * WHAT THE CART KEEPS IS THE ENGINE'S ANSWER: an entry is made by running the
 * customer's comparison again on the server and reading the plan out of it,
 * so the premium written down is the one worked out for these ages — and a
 * plan that is not in the result is refused rather than saved on trust.
 *
 * THE NAME IS AUTOMATIC: "<company> <section> <n>", counted per company and
 * section within the cart.
 *
 * ONE CHOICE: marking an entry as chosen clears the choice from the others.
 *
 * OPT-IN, like the other database suites: runs only when `TEST_DATABASE_URL`
 * is set. Every record is namespaced and removed afterwards.
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addCartItem,
  createCustomer,
  deleteCustomer,
  getCartSummary,
  getCustomer,
  listCustomers,
  removeCartItem,
  updateCartItem,
  updateCustomer,
} from '../src/modules/customers/customers.service.js';
import { createPlanConfiguration } from '../src/modules/plan-configurations/plan-configurations.service.js';
import { createPlan } from '../src/modules/plans/plans.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_customers_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

let counter = 0;
const unique = () => `${PREFIX}_${(counter += 1)}`;

/** One insurer with one individual plan priced at 4,000 for every age. */
async function givenAnInsurerOnSale(companyName = `${PREFIX} Arope`) {
  const company = await db().company.create({ data: { name: companyName } });
  const tag = unique();
  const plan = await createPlan({
    companyId: company.id,
    customerType: 'INDIVIDUAL',
    name: `${PREFIX} Silver`,
    code: tag,
  });
  const variant = await createPlanConfiguration({
    planId: plan.id,
    geographicalCoverage: 'LOCAL',
    currency: 'EGP',
    annualLimit: 300_000,
    priceBands: [{ ageFrom: 0, ageTo: 120, annualPrice: 4_000 }],
  });
  return { company, plan, variant };
}

const criteria = { customerTypeId: 'INDIVIDUAL' as const, ageFrom: 30, ageTo: 30 };

async function cleanup(): Promise<void> {
  if (!prisma) return;
  await prisma.customer.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.plan.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

describe.skipIf(!url)('customers and their carts', () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect();
  });

  it('records a caller with only a name, and finds them by any detail given', async () => {
    const created = await createCustomer({ name: `${PREFIX} Mona` });
    expect(created).toMatchObject({ phone: null, email: null, cartCount: 0, chosenItemId: null });

    await updateCustomer(created.id, { phone: '0100 123 4567', email: 'mona@example.com' });
    expect((await listCustomers({ search: '0100 123' })).map((c) => c.id)).toEqual([created.id]);
    expect((await listCustomers({ search: 'mona@' })).map((c) => c.id)).toEqual([created.id]);
    expect((await listCustomers({ search: `${PREFIX} mo` })).map((c) => c.id)).toEqual([
      created.id,
    ]);
  });

  it('keeps a comparison with the premium the engine worked out, named automatically', async () => {
    const { company, plan, variant } = await givenAnInsurerOnSale();
    const customer = await createCustomer({ name: `${PREFIX} Mona` });

    const first = await addCartItem(customer.id, {
      planConfigurationId: variant.id,
      criteria,
      note: 'Prefers a private room',
    });

    expect(first).toMatchObject({
      name: `${company.name} Individual 1`,
      note: 'Prefers a private room',
      planConfigurationId: variant.id,
      planId: plan.id,
      companyId: company.id,
      companyName: company.name,
      planName: plan.name,
      customerTypeId: 'INDIVIDUAL',
      annualPrice: 4_000,
      currency: 'EGP',
      criteria: { customerTypeId: 'INDIVIDUAL', ageFrom: 30, ageTo: 30 },
      isChosen: false,
    });

    /** The same insurer again is 2; a different insurer starts at 1. */
    const second = await addCartItem(customer.id, { planConfigurationId: variant.id, criteria });
    expect(second.name).toBe(`${company.name} Individual 2`);

    const other = await givenAnInsurerOnSale(`${PREFIX} AXA`);
    const third = await addCartItem(customer.id, {
      planConfigurationId: other.variant.id,
      criteria,
    });
    expect(third.name).toBe(`${other.company.name} Individual 1`);

    /** Read back first to last, and counted on the customer. */
    const read = await getCustomer(customer.id);
    expect(read.cartCount).toBe(3);
    expect(read.items.map((item) => item.name)).toEqual([first.name, second.name, third.name]);
  });

  it('refuses a plan the comparison does not contain', async () => {
    const { variant } = await givenAnInsurerOnSale();
    const customer = await createCustomer({ name: `${PREFIX} Mona` });

    /** An SME comparison cannot contain an individual plan. */
    await expect(
      addCartItem(customer.id, {
        planConfigurationId: variant.id,
        criteria: { customerTypeId: 'SME' },
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      addCartItem(customer.id, { planConfigurationId: 'no-such-variant', criteria }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('lets the customer choose one — and only one — and lets it be taken back', async () => {
    const { variant } = await givenAnInsurerOnSale();
    const customer = await createCustomer({ name: `${PREFIX} Mona` });
    const a = await addCartItem(customer.id, { planConfigurationId: variant.id, criteria });
    const b = await addCartItem(customer.id, { planConfigurationId: variant.id, criteria });

    await updateCartItem(customer.id, a.id, { chosen: true });
    expect((await getCustomer(customer.id)).chosenItemId).toBe(a.id);

    /** Choosing the other moves the choice rather than adding a second. */
    await updateCartItem(customer.id, b.id, { chosen: true });
    const afterMove = await getCustomer(customer.id);
    expect(afterMove.chosenItemId).toBe(b.id);
    expect(afterMove.items.map((item) => item.isChosen)).toEqual([false, true]);

    await updateCartItem(customer.id, b.id, { chosen: false, note: 'Still deciding' });
    const afterUnchoose = await getCustomer(customer.id);
    expect(afterUnchoose.chosenItemId).toBeNull();
    expect(afterUnchoose.items[1]?.note).toBe('Still deciding');
  });

  it('sums every cart for the button, and forgets a removed entry', async () => {
    const { variant } = await givenAnInsurerOnSale();
    const mona = await createCustomer({ name: `${PREFIX} Mona` });
    const omar = await createCustomer({ name: `${PREFIX} Omar` });
    await createCustomer({ name: `${PREFIX} Nobody yet` });

    const kept = await addCartItem(mona.id, { planConfigurationId: variant.id, criteria });
    const removed = await addCartItem(mona.id, { planConfigurationId: variant.id, criteria });
    await addCartItem(omar.id, { planConfigurationId: variant.id, criteria });

    await removeCartItem(mona.id, removed.id);
    /** An entry belongs to its customer: another customer cannot remove it. */
    await expect(removeCartItem(omar.id, kept.id)).rejects.toMatchObject({ status: 404 });

    const summary = await getCartSummary();
    const ours = summary.customers.filter((c) => c.name.startsWith(PREFIX));
    expect(ours.map((c) => [c.name, c.items.length])).toEqual([
      [mona.name, 1],
      [omar.name, 1],
    ]);
    expect(summary.totalItems).toBeGreaterThanOrEqual(2);
  });

  it('keeps the entry readable after the plan is gone, and drops the cart with the customer', async () => {
    const { plan, variant } = await givenAnInsurerOnSale();
    const customer = await createCustomer({ name: `${PREFIX} Mona` });
    const item = await addCartItem(customer.id, { planConfigurationId: variant.id, criteria });

    await db().plan.delete({ where: { id: plan.id } });
    const read = await getCustomer(customer.id);
    expect(read.items[0]).toMatchObject({
      id: item.id,
      planConfigurationId: null,
      planName: plan.name,
      annualPrice: 4_000,
    });

    await deleteCustomer(customer.id);
    expect(await db().customerCartItem.count({ where: { customerId: customer.id } })).toBe(0);
  });
});
