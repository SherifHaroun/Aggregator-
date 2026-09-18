/**
 * LEADS, against a real PostgreSQL database.
 *
 * A visitor leaves their details before the results: that is a customer
 * record — matched by email to one the broker already has, or written down
 * from the website — and a lead at its first stage. Opening a plan notes
 * it once and emails the PDF; choosing one puts it in the cart as the
 * choice and emails the PDF again. Through it all there is ONE lead, which
 * advances and becomes unseen again, never three.
 *
 * The email goes through a stub transport, so the test reads what would
 * have been sent — the address, the subject, the attached PDF — without a
 * mail server. OPT-IN, like the other database suites: runs only when
 * `TEST_DATABASE_URL` is set. Every record is namespaced and removed.
 */

import { PrismaClient } from '@prisma/client';
import type { Transporter } from 'nodemailer';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getCustomer } from '../src/modules/customers/customers.service.js';
import { useEmailTransport } from '../src/modules/leads/email.js';
import {
  choosePlan,
  createLead,
  flushPlanEmails,
  getLead,
  listNotifications,
  markAllNotificationsSeen,
  markNotificationSeen,
  recordPlanView,
} from '../src/modules/leads/leads.service.js';
import { createPlanConfiguration } from '../src/modules/plan-configurations/plan-configurations.service.js';
import { createPlan } from '../src/modules/plans/plans.service.js';

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

const PREFIX = `test_leads_${Date.now()}`;
const db = () => {
  if (!prisma) throw new Error('TEST_DATABASE_URL is not set.');
  return prisma;
};

let counter = 0;
const unique = () => `${PREFIX}_${(counter += 1)}`;

/** What the stub "sent": enough to prove who got what. */
interface Sent {
  to: unknown;
  subject: string;
  attachments: { filename: string; content: Buffer; contentType?: string }[];
}
const outbox: Sent[] = [];
const stubTransport = {
  sendMail: async (mail: Sent) => {
    outbox.push(mail);
    return { messageId: 'stub' };
  },
} as unknown as Transporter;

/** One insurer with one SME plan priced flat, so any workforce is quoted. */
async function givenAnSmePlanOnSale() {
  const company = await db().company.create({ data: { name: `${PREFIX} Arope ${unique()}` } });
  const plan = await createPlan({
    companyId: company.id,
    customerType: 'SME',
    name: `${PREFIX} Gold`,
    code: unique(),
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

const details = {
  firstName: 'Mona',
  lastName: `${PREFIX} Adel`,
  phone: '+20 100 000 0000',
  email: `${PREFIX.toLowerCase()}@example.com`,
  companyName: 'Mona Trading',
  criteria: { customerTypeId: 'SME' as const },
};

async function cleanup(): Promise<void> {
  if (!prisma) return;
  await prisma.customer.deleteMany({ where: { name: { contains: PREFIX } } });
  await prisma.plan.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

/* Every step prices the plan and draws a PDF against a remote database: give it room. */
describe.skipIf(!url)('leads from the customer site', { timeout: 120_000 }, () => {
  beforeEach(async () => {
    await cleanup();
    outbox.length = 0;
    /* Every send goes through the stub, whatever the environment says about SMTP. */
    useEmailTransport(stubTransport);
  });

  afterAll(async () => {
    useEmailTransport(null);
    await cleanup();
    await prisma?.$disconnect();
  });

  it('writes a visitor down as a customer from the website, and matches a returning email to the same record', async () => {
    const first = await createLead(details);
    expect(first).toMatchObject({
      name: `Mona ${PREFIX} Adel`,
      email: details.email,
      phone: details.phone,
      companyName: 'Mona Trading',
      stage: 'COMPARED',
      views: [],
      choice: null,
      seenAt: null,
    });
    const customer = await getCustomer(first.customerId);
    expect(customer).toMatchObject({
      source: 'WEBSITE',
      email: details.email,
      phone: details.phone,
      companyName: 'Mona Trading',
    });
    expect(customer.leads.map((lead) => lead.id)).toEqual([first.id]);

    /** The same email, spelt differently, is the same customer — and a second visit. */
    const second = await createLead({
      ...details,
      email: details.email.toUpperCase(),
      phone: '0111',
    });
    expect(second.customerId).toBe(first.customerId);
    expect((await getCustomer(first.customerId)).phone).toBe('0111');
    expect((await getCustomer(first.customerId)).leads.map((lead) => lead.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('advances ONE lead through opening and choosing, emailing the PDF at each step', async () => {
    const { company, plan, variant } = await givenAnSmePlanOnSale();
    const lead = await createLead(details);
    await markNotificationSeen(lead.id);

    /** Opening a plan: noted once, answered at once, the lead new again. */
    const viewed = await recordPlanView(lead.id, { planConfigurationId: variant.id });
    expect(viewed.stage).toBe('VIEWED');
    expect(viewed.seenAt).toBeNull();
    expect(viewed.views).toHaveLength(1);
    expect(viewed.views[0]).toMatchObject({
      planConfigurationId: variant.id,
      companyName: company.name,
      planName: plan.name,
      customerTypeId: 'SME',
      currency: 'EGP',
      emailStatus: 'PENDING',
    });
    expect(viewed.views[0]!.annualPrice).toBeGreaterThan(0);

    /** The PDF goes out AFTER the answer, and the row then says so. */
    await flushPlanEmails();
    expect((await getLead(lead.id)).views[0]!.emailStatus).toBe('SENT');
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toContain(plan.name);
    expect(outbox[0]!.to).toMatchObject({ address: details.email });
    expect(outbox[0]!.attachments[0]!.filename).toMatch(/\.pdf$/);
    expect(outbox[0]!.attachments[0]!.content.subarray(0, 4).toString()).toBe('%PDF');

    /** Opening it again is not news: nothing sent, nothing changed. */
    const again = await recordPlanView(lead.id, { planConfigurationId: variant.id });
    expect(again.views).toHaveLength(1);
    await flushPlanEmails();
    expect(outbox).toHaveLength(1);

    /** Choosing it: into the cart as the choice, sent again, and the last stage. */
    const chosen = await choosePlan(lead.id, { planConfigurationId: variant.id });
    expect(chosen.stage).toBe('CHOSEN');
    expect(chosen.choice).toMatchObject({
      planConfigurationId: variant.id,
      companyName: company.name,
      planName: plan.name,
      emailStatus: 'PENDING',
    });
    await flushPlanEmails();
    expect((await getLead(lead.id)).choice?.emailStatus).toBe('SENT');
    expect(outbox).toHaveLength(2);
    expect(outbox[1]!.subject).toMatch(/^Your chosen plan/);

    const customer = await getCustomer(lead.customerId);
    expect(customer.items).toHaveLength(1);
    expect(customer.items[0]).toMatchObject({
      id: chosen.choice!.cartItemId,
      planConfigurationId: variant.id,
      isChosen: true,
      note: 'Chosen on the website.',
    });
    expect(customer.chosenItemId).toBe(chosen.choice!.cartItemId);

    /** Still ONE lead, and one notification, saying the last thing they did. */
    const feed = await listNotifications();
    const mine = feed.notifications.filter((row) => row.id === lead.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.stage).toBe('CHOSEN');
    expect(mine[0]!.seenAt).toBeNull();
    expect(feed.unseenCount).toBeGreaterThanOrEqual(1);

    /** Choosing the same plan twice sends nothing more. */
    await choosePlan(lead.id, { planConfigurationId: variant.id });
    await flushPlanEmails();
    expect(outbox).toHaveLength(2);
    expect((await getCustomer(lead.customerId)).items).toHaveLength(1);

    const cleared = await markAllNotificationsSeen();
    expect(cleared.unseenCount).toBe(0);
  });

  it('refuses a plan that is not in the visitor’s results', async () => {
    const lead = await createLead(details);
    await expect(
      recordPlanView(lead.id, { planConfigurationId: 'no-such-variant' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      choosePlan(lead.id, { planConfigurationId: 'no-such-variant' }),
    ).rejects.toMatchObject({ status: 400 });
    await flushPlanEmails();
    expect(outbox).toHaveLength(0);
  });

  it('records an honest status when the server has no mail settings', async () => {
    const { variant } = await givenAnSmePlanOnSale();
    const lead = await createLead(details);
    /* Back to whatever the environment says — which, for the test run, is nothing. */
    useEmailTransport(null);
    await recordPlanView(lead.id, { planConfigurationId: variant.id });
    await flushPlanEmails();
    const after = await getLead(lead.id);
    expect(after.views[0]!.emailStatus).toBe(process.env['SMTP_HOST'] ? 'SENT' : 'NOT_CONFIGURED');
    expect(outbox).toHaveLength(0);
  });
});
