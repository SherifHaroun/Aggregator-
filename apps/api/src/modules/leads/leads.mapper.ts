/**
 * A lead, read out of the database into the shape the screens use.
 *
 * Its own file, with no service imports, because BOTH the leads service and
 * the customers service need it — a customer's page lists their leads — and
 * the leads service already leans on the customers service for the cart.
 */

import type {
  ComparisonRequestInput,
  LeadChoiceDto,
  LeadDto,
  LeadPlanViewDto,
} from '@aggregator/shared';
import type { Lead, LeadPlanView, Prisma } from '@prisma/client';
import { toIso, toNumber } from '../../lib/decimal.js';

/** What a lead is read with, everywhere it is read. */
export const leadInclude = {
  views: { orderBy: { viewedAt: 'asc' as const } },
} as const;

export type LeadRecord = Lead & { views: LeadPlanView[] };

/** Newest activity first: what the bell and a customer's page both want. */
export const leadsNewestFirst = { orderBy: { lastActivityAt: 'desc' as const } } as const;

function toViewDto(view: LeadPlanView): LeadPlanViewDto {
  return {
    planConfigurationId: view.planConfigurationId,
    planId: view.planId,
    companyId: view.companyId,
    companyName: view.companyName,
    planName: view.planName,
    customerTypeId: view.customerType,
    annualPrice: toNumber(view.annualPrice),
    currency: view.currency,
    emailStatus: view.emailStatus,
    emailedAt: view.emailedAt === null ? null : toIso(view.emailedAt),
    viewedAt: toIso(view.viewedAt),
  };
}

function toChoiceDto(lead: Lead): LeadChoiceDto | null {
  if (lead.chosenAt === null || lead.chosenCompanyName === null || lead.chosenPlanName === null) {
    return null;
  }
  return {
    cartItemId: lead.chosenCartItemId,
    planConfigurationId: lead.chosenPlanConfigurationId,
    companyName: lead.chosenCompanyName,
    planName: lead.chosenPlanName,
    annualPrice: toNumber(lead.chosenAnnualPrice),
    currency: lead.chosenCurrency,
    emailStatus: lead.choiceEmailStatus ?? 'PENDING',
    emailedAt: lead.choiceEmailedAt === null ? null : toIso(lead.choiceEmailedAt),
    chosenAt: toIso(lead.chosenAt),
  };
}

/**
 * Stored as the engine validated it, so reading it is a cast rather than a
 * second validation — nothing gets in here that did not pass the schema.
 */
export function leadCriteria(value: Prisma.JsonValue): ComparisonRequestInput {
  return value as unknown as ComparisonRequestInput;
}

export function toLeadDto(lead: LeadRecord): LeadDto {
  return {
    id: lead.id,
    customerId: lead.customerId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    criteria: leadCriteria(lead.criteria),
    stage: lead.stage,
    views: lead.views.map(toViewDto),
    choice: toChoiceDto(lead),
    createdAt: toIso(lead.createdAt),
    lastActivityAt: toIso(lead.lastActivityAt),
    seenAt: lead.seenAt === null ? null : toIso(lead.seenAt),
  };
}
