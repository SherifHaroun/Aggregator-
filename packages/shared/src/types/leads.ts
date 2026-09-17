/**
 * API contracts for LEADS: what a visitor to the customer site did.
 *
 * There is no sign-in on the customer site any more. A visitor fills in the
 * compare card, then — before the results — gives their name, mobile number,
 * email and company. That is a LEAD: a customer record for the employees,
 * with the comparison it was made from, and a running account of how far
 * the visitor went:
 *
 *   COMPARED  they gave their details and saw the results;
 *   VIEWED    they opened one or more plans in full — each is noted, and the
 *             plan's PDF is emailed to them as they open it;
 *   CHOSEN    they chose a plan — it goes into their cart as their choice,
 *             the PDF is emailed again, and the broker calls within a day.
 *
 * ONE LEAD IS ONE NOTIFICATION. It is not three: as the visitor moves
 * through the steps the same lead advances, its `stage` and `lastActivityAt`
 * move on, and it becomes unseen again for the employee's bell.
 */

import type { CustomerTypeId } from '../config/customer-types.js';
import type { ComparisonRequestInput } from './comparison-results.js';

/** The furthest step a visitor took, in order. Mirrored by the Prisma enum `LeadStage`. */
export const LEAD_STAGE_IDS = ['COMPARED', 'VIEWED', 'CHOSEN'] as const;
export type LeadStageId = (typeof LEAD_STAGE_IDS)[number];

/**
 * Whether the plan's PDF reached the visitor's inbox. Mirrored by the Prisma
 * enum `LeadEmailStatus`. `NOT_CONFIGURED` is an honest answer on a server
 * with no mail settings: nothing was sent, and the employee should know.
 */
export const LEAD_EMAIL_STATUS_IDS = ['PENDING', 'SENT', 'FAILED', 'NOT_CONFIGURED'] as const;
export type LeadEmailStatusId = (typeof LEAD_EMAIL_STATUS_IDS)[number];

/** One plan the visitor opened in full, and whether its PDF went out. */
export interface LeadPlanViewDto {
  planConfigurationId: string;
  planId: string | null;
  companyId: string | null;
  companyName: string;
  planName: string;
  customerTypeId: CustomerTypeId;
  annualPrice: number | null;
  currency: string | null;
  emailStatus: LeadEmailStatusId;
  /** ISO 8601, when the PDF was sent. */
  emailedAt: string | null;
  /** ISO 8601, when they first opened it. */
  viewedAt: string;
}

/** The plan the visitor settled on, as it was when they did. */
export interface LeadChoiceDto {
  /** The cart entry it became. `null` once an employee has removed it. */
  cartItemId: string | null;
  planConfigurationId: string | null;
  companyName: string;
  planName: string;
  annualPrice: number | null;
  currency: string | null;
  emailStatus: LeadEmailStatusId;
  emailedAt: string | null;
  /** ISO 8601. */
  chosenAt: string;
}

export interface LeadDto {
  id: string;
  /** The customer record the lead was written down as, or matched to. */
  customerId: string;
  firstName: string;
  lastName: string;
  /** "Mona Adel" — the two names as one, spelled the way the record is. */
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  /** The comparison the visitor ran, so the results open again as they saw them. */
  criteria: ComparisonRequestInput;
  stage: LeadStageId;
  /** Every plan opened in full, first to last. */
  views: LeadPlanViewDto[];
  choice: LeadChoiceDto | null;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601: the last step the visitor took. The bell orders on this. */
  lastActivityAt: string;
  /** ISO 8601, once an employee has seen the lead at its current stage. */
  seenAt: string | null;
}

/** What the "one final step" form sends. */
export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName?: string | null;
  criteria: ComparisonRequestInput;
}

/** Opening a plan in full, or choosing it: which plan. */
export interface LeadPlanInput {
  planConfigurationId: string;
}

/** What the employee's bell reads: how many are new, and the leads themselves. */
export interface NotificationFeedDto {
  unseenCount: number;
  notifications: LeadDto[];
}
