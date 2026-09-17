import {
  LEAD_EMAIL_STATUS_LABELS,
  LEAD_STAGE_LABELS,
  describeLeadActivity,
  formatMoney,
  type LeadDto,
  type LeadEmailStatusId,
  type LeadStageId,
} from '@aggregator/shared';
import { Link } from 'react-router-dom';
import { Badge, IconCheck, IconChevronRight } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { comparisonResultsUrl } from '@/features/comparison/comparison-request';
import { cn } from '@/lib/cn';
import { formatCartDate } from './CartItemList';

const STAGE_TONE: Record<LeadStageId, 'neutral' | 'brand' | 'success'> = {
  COMPARED: 'neutral',
  VIEWED: 'brand',
  CHOSEN: 'success',
};

const EMAIL_TONE: Record<LeadEmailStatusId, 'neutral' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'neutral',
  SENT: 'success',
  FAILED: 'danger',
  NOT_CONFIGURED: 'warning',
};

/**
 * WHAT A CUSTOMER DID ON THE WEBSITE, visit by visit.
 *
 * Each lead is one visit: when, what they compared, every plan they opened
 * in full with whether its PDF reached them, and the plan they chose if
 * they did. The comparison opens again exactly as they saw it — run for
 * this customer, so anything the employee keeps from it goes into the
 * same cart.
 */
export function LeadActivityList({ leads }: { leads: LeadDto[] }) {
  if (leads.length === 0) {
    return (
      <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-6 text-center text-sm">
        No visits from the website. This customer was written down by an employee.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {leads.map((lead) => (
        <li
          key={lead.id}
          data-testid="lead"
          className={cn(
            'border-border-subtle bg-surface rounded-(--radius-card) border p-4',
            lead.stage === 'CHOSEN' && 'border-success bg-success-soft/30',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-content font-semibold">{describeLeadActivity(lead)}</p>
            <Badge tone={STAGE_TONE[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
            <span className="text-content-subtle text-xs">
              {formatCartDate(lead.lastActivityAt)}
            </span>
            {lead.seenAt === null ? <Badge tone="brand">New</Badge> : null}
          </div>
          <p className="text-content-muted mt-0.5 text-sm">
            {lead.email} · {lead.phone}
            {lead.companyName ? ` · ${lead.companyName}` : ''}
          </p>

          {lead.views.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {lead.views.map((view) => (
                <li
                  key={view.planConfigurationId}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="text-content">
                    Opened {view.companyName} · {view.planName}
                  </span>
                  <span className="text-content-muted tabular-nums">
                    {formatMoney(view.annualPrice, view.currency)}
                    {view.annualPrice !== null ? ' / year' : ''}
                  </span>
                  <Badge tone={EMAIL_TONE[view.emailStatus]}>
                    {LEAD_EMAIL_STATUS_LABELS[view.emailStatus]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {lead.choice ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-success inline-flex items-center gap-1 font-semibold">
                <IconCheck className="size-4" />
                Chose {lead.choice.companyName} · {lead.choice.planName}
              </span>
              <span className="text-content-muted tabular-nums">
                {formatMoney(lead.choice.annualPrice, lead.choice.currency)}
                {lead.choice.annualPrice !== null ? ' / year' : ''}
              </span>
              <Badge tone={EMAIL_TONE[lead.choice.emailStatus]}>
                {LEAD_EMAIL_STATUS_LABELS[lead.choice.emailStatus]}
              </Badge>
            </p>
          ) : null}

          <div className="mt-3">
            <Link
              to={comparisonResultsUrl(ROUTES.comparison.results, lead.criteria, lead.customerId)}
              className="text-brand-strong inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              Open their comparison
              <IconChevronRight className="size-4" />
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
