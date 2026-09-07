import {
  PROVIDER_LIST_DOWNLOAD_LABEL,
  PROVIDER_LIST_PANEL_TITLE,
  providerListPanelSubtitle,
  type ComparisonPlanResult,
} from '@aggregator/shared';
import { IconDownload } from '@/components/ui';
import { providerListUrl } from '@/lib/api-url';

/**
 * THE ONE THING A CUSTOMER IS GIVEN ABOUT THE NETWORK BEYOND ITS NAME.
 *
 * The provider list, as the insurer published it — opened from the network's
 * stable address, so it is always the current file. Drawn as the same panel
 * the PDF carries: a badge, what is on offer, which network, and the button.
 * Nothing about tiers or cards appears anywhere: those are negotiated per
 * client.
 *
 * Renders nothing when the network has no list on file, rather than a link
 * that leads to an error.
 */
export function ProviderListLink({ plan }: { plan: ComparisonPlanResult }) {
  if (!plan.medicalNetworkId || !plan.medicalNetworkHasProviderList) return null;
  const name = plan.medicalNetworkName ?? 'the network';
  const initial = (name.trim()[0] ?? 'N').toUpperCase();

  return (
    <div className="bg-brand-soft/50 flex flex-wrap items-center gap-4 rounded-(--radius-card) px-4 py-3">
      <span
        aria-hidden
        className="bg-brand text-content-inverted flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-content text-sm font-semibold">{PROVIDER_LIST_PANEL_TITLE}</p>
        <p className="text-content-muted text-xs">{providerListPanelSubtitle(name)}</p>
      </div>
      <a
        href={providerListUrl(plan.medicalNetworkId)}
        className="bg-brand text-content-inverted hover:bg-brand-strong inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-control) px-4 py-2 text-xs font-bold tracking-wide uppercase transition-colors"
      >
        <IconDownload className="size-4" />
        {PROVIDER_LIST_DOWNLOAD_LABEL}
      </a>
    </div>
  );
}
