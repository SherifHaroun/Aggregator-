import {
  NETWORK_PROVIDER_CATEGORIES,
  NO_NETWORK_PROVIDERS_LABEL,
  networkProviderEmoji,
  type CompanyMedicalNetworkDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Button, IconAdd, IconTrash, Input, NumberInput, describeError, useToast } from '@/components/ui';
import { useSetNetworkProviders } from '@/features/insurance-data/insurance-data.api';

/**
 * What a network gives access to — its estate of hospitals, pharmacies,
 * laboratories and the rest.
 *
 * ENTERED ONCE PER NETWORK, then read by every plan variant sold on it. The
 * legacy system did exactly this and it was the one thing its schema got right:
 * ten provider columns on the network, joined from the plan, never re-typed.
 *
 * A category takes a FIGURE, WORDING, or both, because insurers state it
 * differently — "1,240 hospitals" from one, "all major hospitals in Greater
 * Cairo" from another. Neither is required, and a row with neither is simply
 * not kept.
 */
export function NetworkProviders({
  companyId,
  network,
  onClose,
}: {
  companyId: string;
  network: CompanyMedicalNetworkDto;
  onClose: () => void;
}) {
  const save = useSetNetworkProviders(companyId);
  const { notify } = useToast();

  /**
   * Every standard category is offered as a row, whether or not this network
   * has filled it in — an employee reading a document down a list should not
   * have to add each heading before answering it. Anything recorded under a
   * category nobody anticipated is kept and shown alongside them.
   */
  const [rows, setRows] = useState<{ category: string; count: string; detail: string }[]>(() => {
    const recorded = new Map(
      (network.providers ?? []).map((provider) => [provider.category.toLowerCase(), provider]),
    );
    const standard = NETWORK_PROVIDER_CATEGORIES.map((item) => {
      const found = recorded.get(item.name.toLowerCase());
      recorded.delete(item.name.toLowerCase());
      return {
        category: item.name,
        count: found?.count === null || found?.count === undefined ? '' : String(found.count),
        detail: found?.detail ?? '',
      };
    });
    const invented = [...recorded.values()].map((provider) => ({
      category: provider.category,
      count: provider.count === null ? '' : String(provider.count),
      detail: provider.detail ?? '',
    }));
    return [...standard, ...invented];
  });

  function setRow(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function commit() {
    save.mutate(
      {
        networkId: network.id,
        providers: rows.map((row) => ({
          category: row.category.trim(),
          count: row.count.trim() === '' ? null : Number(row.count),
          detail: row.detail.trim() === '' ? null : row.detail.trim(),
        })),
      },
      {
        onSuccess: () => {
          notify(`Provider information saved for ${network.name}.`);
          onClose();
        },
        onError: (error) => notify(describeError(error, 'the network'), 'error'),
      },
    );
  }

  const recorded = network.providers?.length ?? 0;

  return (
    <div className="border-border-subtle bg-surface-muted/40 mt-2 rounded-(--radius-control) border p-3">
      <p className="text-content-subtle mb-3 text-xs">
        {recorded === 0
          ? NO_NETWORK_PROVIDERS_LABEL
          : 'Read by every plan sold on this network — entered only here.'}
      </p>

      <div className="text-content-subtle grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1.4fr)_auto] gap-2 px-1 pb-1.5 text-[11px] font-semibold tracking-wide uppercase">
        <span>Category</span>
        <span>How many</span>
        <span>Detail</span>
        <span className="w-7" />
      </div>

      <ul className="space-y-1.5">
        {rows.map((row, index) => (
          <li
            key={`${row.category}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1.4fr)_auto] items-center gap-2"
          >
            <span className="text-content flex items-center gap-2 text-sm">
              <span aria-hidden className="text-base leading-none">
                {networkProviderEmoji(row.category)}
              </span>
              <span className="truncate">{row.category}</span>
            </span>

            <NumberInput
              aria-label={`${row.category} count`}
              value={row.count}
              onChange={(value) => setRow(index, { count: value })}
              placeholder="—"
              className="text-sm"
            />

            <Input
              aria-label={`${row.category} detail`}
              value={row.detail}
              onChange={(event) => setRow(index, { detail: event.target.value })}
              placeholder="Wording, where the document gives one"
              className="text-sm"
            />

            <button
              type="button"
              aria-label={`Clear ${row.category}`}
              className="text-content-subtle hover:text-danger rounded p-1.5"
              onClick={() => setRow(index, { count: '', detail: '' })}
            >
              <IconTrash className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-content-subtle hover:text-brand inline-flex items-center gap-1.5 text-xs font-medium"
          onClick={() =>
            setRows((current) => [...current, { category: '', count: '', detail: '' }])
          }
        >
          <IconAdd className="size-3.5" />
          Add category
        </button>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save providers'}
          </Button>
        </div>
      </div>
    </div>
  );
}
