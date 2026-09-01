import { PLAN_TIERS, listAllOptions, planTier, type PlanTierId } from '@aggregator/shared';
import { useMemo } from 'react';
import { Badge, DataState, DataTable, PageHeader, type Column } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { usePlanConfigurations } from '@/features/insurance-data/insurance-data.api';
import { formatMoney } from '@/features/insurance-data/labels';

interface TierRow {
  id: PlanTierId;
  label: string;
  description: string;
  variants: number;
}

/**
 * WHAT BASIC, STANDARD AND PREMIUM MEAN.
 *
 * A reference, not a register. These three are not records an employee creates
 * and files plans under — they are a reading of each variant's annual limit,
 * worked out wherever a variant is shown. Nothing here can be added, renamed or
 * deleted, because there is nothing stored to change: move a ceiling and the
 * tier moves with it.
 *
 * This replaced a table of hand-picked categories — Base, Middle, High,
 * Standard, Medical — which could disagree with a plan's own figures and said
 * nothing a comparison could act on.
 */
export function PlanTiersPage() {
  const variants = usePlanConfigurations({ isActive: true });

  const rows = useMemo<TierRow[]>(() => {
    const tally = new Map<PlanTierId, number>();
    for (const variant of variants.data ?? []) {
      const tier = planTier(variant.annualLimit);
      if (tier) tally.set(tier, (tally.get(tier) ?? 0) + 1);
    }
    return listAllOptions(PLAN_TIERS).map((tier) => ({
      id: tier.id,
      label: tier.label,
      description: tier.description ?? '',
      variants: tally.get(tier.id) ?? 0,
    }));
  }, [variants.data]);

  /** Variants whose document never stated a ceiling belong to no tier at all. */
  const unstated = (variants.data ?? []).filter(
    (variant) => variant.annualLimit === null,
  ).length;

  const columns: Column<TierRow>[] = [
    {
      key: 'tier',
      header: 'Plan tier',
      render: (row) => <span className="text-content font-semibold">{row.label}</span>,
    },
    {
      key: 'range',
      header: 'Annual limit',
      render: (row) => {
        const { minAnnualLimit, maxAnnualLimit } = PLAN_TIERS[row.id];
        if (minAnnualLimit === null) return `Below ${formatMoney(maxAnnualLimit! + 1, null)}`;
        if (maxAnnualLimit === null) return `Above ${formatMoney(minAnnualLimit - 1, null)}`;
        return `${formatMoney(minAnnualLimit, null)} – ${formatMoney(maxAnnualLimit, null)}`;
      },
    },
    {
      key: 'variants',
      header: 'Variants',
      hideOnMobile: true,
      render: (row) =>
        row.variants === 0 ? (
          <span className="text-content-subtle">None yet</span>
        ) : (
          <span className="text-content-muted">{row.variants}</span>
        ),
    },
    {
      key: 'source',
      header: 'Set by',
      hideOnMobile: true,
      render: () => <Badge tone="neutral">Annual limit</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Plan tiers"
        description="How good a plan is, read off its annual limit. Nothing to choose — raise a variant's ceiling and its tier follows."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Plan tiers' }]}
      />

      <DataState
        isLoading={variants.isLoading}
        error={variants.error}
        data={rows}
        subject="the plan tiers"
        onRetry={() => void variants.refetch()}
        empty={{ title: 'No plan tiers' }}
      >
        {(data) => (
          <div className="space-y-4">
            <DataTable items={data} columns={columns} getRowKey={(row) => row.id} />
            {unstated > 0 ? (
              <p className="text-content-muted text-sm">
                {unstated} {unstated === 1 ? 'variant states' : 'variants state'} no annual limit,
                so {unstated === 1 ? 'it belongs' : 'they belong'} to no tier. A blank ceiling is
                the document saying nothing — it is not the cheapest tier.
              </p>
            ) : null}
          </div>
        )}
      </DataState>
    </>
  );
}
