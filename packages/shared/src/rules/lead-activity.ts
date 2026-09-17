/**
 * WHAT A LEAD SAYS, in words — the line the employee's bell shows.
 *
 * One sentence per lead, always about the LAST step the visitor took: not
 * "compared, then viewed, then chose", but "chose Arope · Gold". The steps
 * before it are still on the lead for the customer's page; the bell is for
 * knowing what to do next.
 */

import { formatMoney } from './insurance-labels.js';
import type { LeadDto, LeadEmailStatusId, LeadStageId } from '../types/leads.js';

/** The stage, as a badge reads it. */
export const LEAD_STAGE_LABELS: Record<LeadStageId, string> = {
  COMPARED: 'Compared',
  VIEWED: 'Viewed details',
  CHOSEN: 'Chose a plan',
};

/** How the email went, as a badge reads it. */
export const LEAD_EMAIL_STATUS_LABELS: Record<LeadEmailStatusId, string> = {
  PENDING: 'PDF sending',
  SENT: 'PDF sent',
  FAILED: 'PDF not sent',
  NOT_CONFIGURED: 'PDF not sent (email not set up)',
};

/** "Arope · Gold" — the plan, named by its insurer first. */
function planLabel(companyName: string, planName: string): string {
  return `${companyName} · ${planName}`;
}

/**
 * The headline: who, and what they last did.
 *
 *   "Mona Adel compared SME plans"
 *   "Mona Adel viewed Arope · Gold and AXA · Silver"
 *   "Mona Adel chose Arope · Gold"
 */
export function describeLeadActivity(lead: LeadDto): string {
  if (lead.stage === 'CHOSEN' && lead.choice) {
    return `${lead.name} chose ${planLabel(lead.choice.companyName, lead.choice.planName)}`;
  }
  if (lead.stage === 'VIEWED' && lead.views.length > 0) {
    const names = lead.views.map((view) => planLabel(view.companyName, view.planName));
    const shown =
      names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} more`;
    return `${lead.name} viewed ${shown}`;
  }
  return `${lead.name} compared plans`;
}

/**
 * The line under the headline: the price of what they chose or last viewed,
 * and whether the PDF reached them.
 */
export function describeLeadDetail(lead: LeadDto): string {
  const target =
    lead.stage === 'CHOSEN' && lead.choice
      ? lead.choice
      : lead.stage === 'VIEWED'
        ? (lead.views[lead.views.length - 1] ?? null)
        : null;
  const parts: string[] = [];
  if (lead.companyName) parts.push(lead.companyName);
  if (target) {
    if (target.annualPrice !== null) {
      parts.push(`${formatMoney(target.annualPrice, target.currency)} / year`);
    }
    parts.push(LEAD_EMAIL_STATUS_LABELS[target.emailStatus]);
  }
  return parts.join(' · ');
}
