/**
 * WHICH LEAD THIS VISITOR IS.
 *
 * Nobody signs in on the customer site. Once a visitor has left their
 * details, the lead's id is what identifies them for the rest of the visit:
 * it travels in the URL beside the comparison (`?lead=`), so the results and
 * a plan opened from them know whose visit to write to, and a link copied
 * from the address bar still works. It is also kept in the tab's session
 * storage, so a visitor who goes back to the compare card and runs another
 * comparison is not asked for their name again — the form is filled in for
 * them, and they confirm rather than retype.
 */

import type { CreateLeadInput, LeadDto } from '@aggregator/shared';

export const LEAD_PARAM = 'lead';

const KEY = 'hadbrok.lead';

/** What is remembered between comparisons: the lead, and what they typed. */
export interface RememberedLead {
  id: string;
  details: Omit<CreateLeadInput, 'criteria'>;
}

export function leadIdOf(params: URLSearchParams): string | null {
  return params.get(LEAD_PARAM)?.trim() || null;
}

/** The same query string, with the lead beside the comparison. */
export function withLead(params: URLSearchParams, leadId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(LEAD_PARAM, leadId);
  return next;
}

/** The comparison alone, for a link back to the form or the results. */
export function withoutLead(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(LEAD_PARAM);
  return next;
}

export function rememberLead(lead: LeadDto): void {
  const remembered: RememberedLead = {
    id: lead.id,
    details: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      companyName: lead.companyName,
    },
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(remembered));
  } catch {
    /* A private window: the URL still carries the lead for this visit. */
  }
}

export function recallLead(): RememberedLead | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedLead>;
    if (typeof parsed.id !== 'string' || !parsed.details) return null;
    return parsed as RememberedLead;
  } catch {
    return null;
  }
}
