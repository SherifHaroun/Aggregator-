import { PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { MedicalNetworkList } from '@/features/medical-networks/MedicalNetworkList';

/**
 * WHERE THE PROVIDER LISTS LIVE.
 *
 * A network belongs to no company — GlobeMed is one network however many
 * insurers sell on it — so the list has a screen of its own, beside the
 * benefit catalogue. When an insurer sends a new spreadsheet it is replaced
 * here, once, and every plan on that network hands out the new file from then
 * on: on screen, and from every PDF already in a customer's hands.
 */
export function MedicalNetworksPage() {
  return (
    <>
      <PageHeader
        title="Medical networks"
        description="The networks plans are sold on, and the provider list each one gives customers. Upload a new file whenever the insurer sends one — every plan on the network updates at once."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Medical networks' }]}
      />
      <MedicalNetworkList />
    </>
  );
}
