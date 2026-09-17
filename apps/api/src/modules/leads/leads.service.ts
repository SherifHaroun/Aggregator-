/**
 * LEADS: what a visitor to the customer site did, written down for the broker.
 *
 * THREE STEPS, ONE ROW. A visitor gives their details before the results
 * (`createLead`); opening a plan in full notes it and emails them the PDF
 * (`recordPlanView`); choosing a plan puts it in their cart as their choice
 * and emails the PDF again (`choosePlan`). Each step ADVANCES the same lead
 * — its stage, its `lastActivityAt`, and it becomes unseen again — so the
 * employee's bell holds one line per visit, saying the last thing they did.
 *
 * THE CUSTOMER RECORD IS THE SAME ONE THE EMPLOYEES WORK WITH. A visitor is
 * matched by email to a customer the broker already has, or written down as
 * a new one from the website; the chosen plan is a real cart entry, so it is
 * in "Offers requested" like any plan an employee kept on a call.
 *
 * WHAT IS EMAILED is the engine's answer, not the screen's: the comparison is
 * run again here and the plan read out of its result before it is drawn.
 */

import { presentPremium, type LeadDto, type NotificationFeedDto } from '@aggregator/shared';
import type { Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../lib/errors.js';
import { getPrisma } from '../../lib/prisma.js';
import { comparisonRequestSchema } from '../comparison/comparison.schemas.js';
import { addCartItem, updateCartItem } from '../customers/customers.service.js';
import { sendPlanEmail, type EmailOutcome } from './email.js';
import {
  leadCriteria,
  leadInclude,
  leadsNewestFirst,
  toLeadDto,
  type LeadRecord,
} from './leads.mapper.js';
import type { CreateLeadPayload, LeadPlanPayload } from './leads.schemas.js';
import { buildPricedPlanDocument } from './plan-pdf.js';

const NOT_IN_RESULTS = () =>
  badRequest('That plan is not in your results. Go back to the results and try again.', {
    planConfigurationId: ['Not in this comparison.'],
  });

async function findLead(id: string): Promise<LeadRecord> {
  const lead = await getPrisma().lead.findUnique({ where: { id }, include: leadInclude });
  if (!lead) throw notFound('Lead');
  return lead;
}

export async function getLead(id: string): Promise<LeadDto> {
  return toLeadDto(await findLead(id));
}

/**
 * THE ONE FINAL STEP. The visitor becomes a customer — matched by email to
 * a record the broker already has, whose details are brought up to date
 * with what was just typed, or a new one from the website — and the visit
 * becomes a lead at its first stage.
 */
export async function createLead(input: CreateLeadPayload): Promise<LeadDto> {
  const prisma = getPrisma();
  const name = `${input.firstName} ${input.lastName}`.trim();
  const companyName = input.companyName ?? null;

  const existing = await prisma.customer.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, companyName: true },
  });

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name,
          phone: input.phone,
          email: input.email,
          companyName: companyName ?? existing.companyName,
        },
        select: { id: true },
      })
    : await prisma.customer.create({
        data: { name, phone: input.phone, email: input.email, companyName, source: 'WEBSITE' },
        select: { id: true },
      });

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      companyName,
      criteria: input.criteria as unknown as Prisma.InputJsonValue,
      stage: 'COMPARED',
    },
    include: leadInclude,
  });
  return toLeadDto(lead);
}

/**
 * THE VISITOR OPENED A PLAN IN FULL. Noted once per plan — opening it again
 * is not news — and the PDF goes to their inbox as they read the page. The
 * lead moves to VIEWED (never back from CHOSEN) and is new again for the
 * bell, because a second plan opened is a second thing worth knowing.
 */
export async function recordPlanView(leadId: string, input: LeadPlanPayload): Promise<LeadDto> {
  const prisma = getPrisma();
  const lead = await findLead(leadId);

  if (lead.views.some((view) => view.planConfigurationId === input.planConfigurationId)) {
    return toLeadDto(lead);
  }

  const criteria = comparisonRequestSchema.parse(leadCriteria(lead.criteria));
  const priced = await buildPricedPlanDocument(criteria, input.planConfigurationId, leadName(lead));
  if (!priced) throw NOT_IN_RESULTS();
  const { plan } = priced;

  const now = new Date();
  const view = await prisma.leadPlanView.create({
    data: {
      leadId: lead.id,
      planConfigurationId: plan.configurationId,
      planId: plan.planId,
      companyId: plan.companyId,
      companyName: plan.companyName,
      planName: plan.planName,
      customerType: criteria.customerTypeId,
      annualPrice: plan.annualPrice,
      currency: plan.currency,
      emailStatus: 'PENDING',
      viewedAt: now,
    },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(lead.stage === 'COMPARED' ? { stage: 'VIEWED' } : {}),
      lastActivityAt: now,
      seenAt: null,
    },
  });

  const outcome = await sendPlanEmail({
    to: { name: leadName(lead), address: lead.email },
    subject: `Your ${plan.companyName} ${plan.planName} plan details`,
    intro: `Thank you for comparing plans with Hadbrok. Here are the full details of the plan you opened, priced for what you told us.`,
    plan: { companyName: plan.companyName, planName: plan.planName, premium: priced.premium },
    attachment: { filename: priced.file.filename, bytes: priced.file.bytes },
  });
  await prisma.leadPlanView.update({ where: { id: view.id }, data: emailColumns(outcome) });

  return getLead(lead.id);
}

/**
 * THE VISITOR CHOSE A PLAN. It goes into their cart — the same cart an
 * employee fills on a call — and is marked as their choice, which clears any
 * other; the PDF is sent again under a subject that says so; and the lead
 * reaches its last stage. Choosing the same plan twice changes nothing and
 * sends nothing; choosing a different one moves the choice.
 */
export async function choosePlan(leadId: string, input: LeadPlanPayload): Promise<LeadDto> {
  const prisma = getPrisma();
  const lead = await findLead(leadId);

  if (
    lead.stage === 'CHOSEN' &&
    lead.chosenPlanConfigurationId === input.planConfigurationId &&
    lead.choiceEmailStatus === 'SENT'
  ) {
    return toLeadDto(lead);
  }

  const criteria = comparisonRequestSchema.parse(leadCriteria(lead.criteria));
  const priced = await buildPricedPlanDocument(criteria, input.planConfigurationId, leadName(lead));
  if (!priced) throw NOT_IN_RESULTS();
  const { plan } = priced;

  /* The cart entry: reuse the one this lead already made for this plan. */
  const previous =
    lead.chosenCartItemId && lead.chosenPlanConfigurationId === plan.configurationId
      ? await prisma.customerCartItem.findFirst({
          where: { id: lead.chosenCartItemId, customerId: lead.customerId },
          select: { id: true },
        })
      : null;
  const item =
    previous ??
    (await addCartItem(lead.customerId, {
      planConfigurationId: plan.configurationId,
      criteria,
      note: 'Chosen on the website.',
    }));
  await updateCartItem(lead.customerId, item.id, { chosen: true });

  const now = new Date();
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'CHOSEN',
      chosenCartItemId: item.id,
      chosenPlanConfigurationId: plan.configurationId,
      chosenCompanyName: plan.companyName,
      chosenPlanName: plan.planName,
      chosenAnnualPrice: plan.annualPrice,
      chosenCurrency: plan.currency,
      chosenAt: now,
      choiceEmailStatus: 'PENDING',
      choiceEmailedAt: null,
      choiceEmailError: null,
      lastActivityAt: now,
      seenAt: null,
    },
  });

  const outcome = await sendPlanEmail({
    to: { name: leadName(lead), address: lead.email },
    subject: `Your chosen plan: ${plan.companyName} ${plan.planName}`,
    intro: `Thank you for choosing a plan with Hadbrok. The plan you chose is attached, priced at ${presentPremium(plan)} a year for what you told us.`,
    plan: { companyName: plan.companyName, planName: plan.planName, premium: priced.premium },
    attachment: { filename: priced.file.filename, bytes: priced.file.bytes },
  });
  const columns = emailColumns(outcome);
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      choiceEmailStatus: columns.emailStatus,
      choiceEmailedAt: columns.emailedAt,
      choiceEmailError: columns.emailError,
    },
  });

  return getLead(lead.id);
}

// ---------------------------------------------------------------------------
// The bell
// ---------------------------------------------------------------------------

/** How many leads the bell shows at most: the recent ones, newest activity first. */
const FEED_LIMIT = 50;

export async function listNotifications(): Promise<NotificationFeedDto> {
  const prisma = getPrisma();
  const [leads, unseenCount] = await Promise.all([
    prisma.lead.findMany({ include: leadInclude, ...leadsNewestFirst, take: FEED_LIMIT }),
    prisma.lead.count({ where: { seenAt: null } }),
  ]);
  return { unseenCount, notifications: leads.map(toLeadDto) };
}

export async function markNotificationSeen(id: string): Promise<LeadDto> {
  const prisma = getPrisma();
  await findLead(id);
  const lead = await prisma.lead.update({
    where: { id },
    data: { seenAt: new Date() },
    include: leadInclude,
  });
  return toLeadDto(lead);
}

export async function markAllNotificationsSeen(): Promise<NotificationFeedDto> {
  await getPrisma().lead.updateMany({ where: { seenAt: null }, data: { seenAt: new Date() } });
  return listNotifications();
}

// ---------------------------------------------------------------------------

function leadName(lead: LeadRecord): string {
  return `${lead.firstName} ${lead.lastName}`.trim();
}

function emailColumns(outcome: EmailOutcome) {
  return {
    emailStatus: outcome.status,
    emailedAt: outcome.status === 'SENT' ? outcome.at : null,
    emailError: outcome.error,
  } as const;
}
