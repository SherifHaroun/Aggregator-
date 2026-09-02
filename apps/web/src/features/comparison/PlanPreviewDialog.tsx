import { type ComparisonPlanResult } from '@aggregator/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, IconChevronRight, IconDownload } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { AnnualLimitPanel, CoreBenefitList, PlanFigures, PlanIdentity } from './PlanSummary';
import { usePlanDocumentSource } from './usePlanDocument';
import { downloadPlanDocument } from './plan-document';

/**
 * A PLAN, OPENED WHERE IT SITS.
 *
 * Every plan opens the same way — the recommended one and the fifteen beneath
 * it alike. Reserving the fuller presentation for the winner told the customer
 * the others were not worth reading, which is the opposite of a comparison.
 *
 * It is a PREVIEW, so it costs nothing to open and nothing to close: the
 * criteria, the scroll position and the rest of the results are all still
 * there behind it. The full page is a deliberate step further, not the price
 * of a second look.
 */
export function PlanPreviewDialog({
  plan,
  criteria,
  onClose,
}: {
  plan: ComparisonPlanResult | null;
  /** The comparison's own query string, so the full page opens on this plan. */
  criteria: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'benefits' | 'coverage'>('overview');
  const document = usePlanDocumentSource(plan?.configurationId ?? null, plan?.planId ?? null);

  if (!plan) return null;

  const fullPage = `${ROUTES.comparison.plan(plan.configurationId)}?${criteria}`;

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'coverage', label: 'Coverage details' },
  ] as const;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${plan.companyName} — ${plan.planName}`}
      size="lg"
      /**
       * Room to read the whole plan at once. Six benefits, the additional
       * ones and the coverage terms are more than a letterbox holds, and a
       * customer comparing plans should not have to scroll a modal to see one.
       */
      expandable
      leading={
        <button
          type="button"
          onClick={onClose}
          className="text-content-muted hover:bg-surface-muted hover:text-content -ml-2 flex shrink-0 items-center gap-1 rounded-(--radius-control) px-2 py-1.5 text-sm font-medium"
        >
          <IconChevronRight className="size-4 rotate-180" />
          Back to plans
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PlanIdentity plan={plan} size="lg" />
          <PlanFigures plan={plan} />
        </div>

        <AnnualLimitPanel plan={plan} explain />

        <div className="border-border-subtle flex gap-1 border-b" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === entry.id
                  ? 'border-brand text-content'
                  : 'text-content-muted hover:text-content border-transparent',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <h4 className="text-content mb-2 text-sm font-semibold">About this plan</h4>
              <p className="text-content-muted text-sm leading-relaxed">
                {document.description ??
                  `${plan.planName} is sold by ${plan.companyName} to ${plan.customerTypeLabel.toLowerCase()} customers with ${plan.geographicalCoverageLabel.toLowerCase()} cover.`}
              </p>
            </section>
            <section>
              <h4 className="text-content mb-2 text-sm font-semibold">Core benefits</h4>
              <CoreBenefitList plan={plan} />
            </section>
          </div>
        ) : null}

        {tab === 'benefits' ? (
          <div className="space-y-5">
            <section>
              <h4 className="text-content mb-2 text-sm font-semibold">Core benefits</h4>
              <CoreBenefitList plan={plan} columns={2} bars />
            </section>
            <section>
              <h4 className="text-content mb-2 text-sm font-semibold">Additional benefits</h4>
              {document.additional.length === 0 ? (
                <p className="text-content-subtle text-sm">
                  This plan states none beyond the six compared above.
                </p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {document.additional.map((benefit) => (
                    <li key={benefit.name} className="flex items-baseline justify-between gap-3">
                      <span className="text-content-muted min-w-0 truncate text-sm">
                        {benefit.name}
                      </span>
                      <span className="text-content shrink-0 text-sm font-medium">
                        {benefit.value ?? 'Covered'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {tab === 'coverage' ? (
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[
              ['Plan type', plan.customerTypeLabel],
              ['Coverage', plan.geographicalCoverageLabel],
              ['Currency', plan.currency ?? '—'],
              ['Medical network', plan.medicalNetworkName ?? 'Not specified in plan'],
            ].map(([label, value]) => (
              <div key={label} className="border-border-subtle flex justify-between border-b py-2">
                <dt className="text-content-muted text-sm">{label}</dt>
                <dd className="text-content text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => downloadPlanDocument({ plan, ...document })}>
            <IconDownload className="size-4" />
            Download PDF
          </Button>
          <Button onClick={() => navigate(fullPage)}>
            View plan
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
