import { PROVIDER_LIST_DOWNLOAD_LABEL, type ComparisonPlanResult } from '@aggregator/shared';
import { IconDownload } from '@/components/ui';
import { providerListUrl } from '@/lib/api-url';

/**
 * THE ONE THING A CUSTOMER IS GIVEN ABOUT THE NETWORK BEYOND ITS NAME.
 *
 * The provider list, as the insurer published it — opened from the network's
 * stable address, so it is always the current file. Nothing about tiers or
 * cards appears anywhere: those are negotiated per client.
 *
 * Renders nothing when the network has no list on file, rather than a link
 * that leads to an error.
 */
export function ProviderListLink({ plan }: { plan: ComparisonPlanResult }) {
  if (!plan.medicalNetworkId || !plan.medicalNetworkHasProviderList) return null;

  return (
    <a
      href={providerListUrl(plan.medicalNetworkId)}
      className="text-brand-strong bg-brand-soft hover:bg-brand hover:text-content-inverted inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-1.5 text-sm font-semibold transition-colors"
    >
      <IconDownload className="size-4" />
      {PROVIDER_LIST_DOWNLOAD_LABEL}
      {plan.medicalNetworkName ? (
        <span className="font-normal opacity-80">· {plan.medicalNetworkName}</span>
      ) : null}
    </a>
  );
}
