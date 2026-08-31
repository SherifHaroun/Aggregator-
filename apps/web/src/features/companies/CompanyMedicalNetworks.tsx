import type { CompanyMedicalNetworkDto } from '@aggregator/shared';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  IconEdit,
  IconGrip,
  IconLayers,
  IconTrash,
  Input,
  describeError,
  useToast,
} from '@/components/ui';
import {
  useCreateMedicalNetwork,
  useDeleteMedicalNetwork,
  useMedicalNetworks,
  useReorderMedicalNetworks,
  useSaveMedicalNetwork,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { NetworkProviders } from './NetworkProviders';

/**
 * The provider networks THIS company sells, in the order it ranks them.
 *
 * A network is not a benefit. It is the estate of hospitals and clinics the
 * company gives access to, and every plan that company offers is sold on one of
 * them. Held as a benefit it had to be re-typed on every plan of every company,
 * and there was nowhere to say that a company ranks one of its own above
 * another.
 *
 * THE LIST IS THE COMPANY'S OWN. One insurer's Tier 4 has nothing to do with
 * another's, so nothing here is shared and no plan may name a network belonging
 * to a different company.
 *
 * Every change saves itself, like the rest of the application.
 */
export function CompanyMedicalNetworks({ companyId }: { companyId: string }) {
  const networks = useMedicalNetworks(companyId);
  const reorder = useReorderMedicalNetworks(companyId);
  const { notify } = useToast();

  /** The order shown while a drag is saving, so a row stays where it was dropped. */
  const [pending, setPending] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    const list = networks.data ?? [];
    if (!pending) return list;
    const byId = new Map(list.map((network) => [network.id, network]));
    return pending.flatMap((id) => byId.get(id) ?? []);
  }, [networks.data, pending]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ordered.findIndex((network) => network.id === active.id);
    const to = ordered.findIndex((network) => network.id === over.id);
    if (from === -1 || to === -1) return;

    const orderedIds = arrayMove(ordered, from, to).map((network) => network.id);
    setPending(orderedIds);
    reorder.mutate(
      { orderedIds },
      {
        onSettled: () => setPending(null),
        onError: (error) => notify(describeError(error, 'the order'), 'error'),
      },
    );
  }

  return (
    <Card>
      <CardHeader
        title="Medical networks"
        description="The provider networks this company sells. Drag to rank them, best first — plans choose from this list."
        icon={<IconLayers className="size-5" />}
      />
      <CardBody className="space-y-2">
        {networks.isPending ? (
          <p className="text-content-subtle px-1 py-2 text-sm">Loading…</p>
        ) : ordered.length === 0 ? (
          <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-sm">
            No networks yet. Add the ones this company sells — its plans pick from them.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ordered.map((network) => network.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol aria-label="Medical networks" className="space-y-1.5">
                {ordered.map((network, index) => (
                  <NetworkRow
                    key={network.id}
                    companyId={companyId}
                    network={network}
                    position={index + 1}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <NewNetwork companyId={companyId} />
      </CardBody>
    </Card>
  );
}

/** One network: drag to rank it, rename it, or remove it. */
function NetworkRow({
  companyId,
  network,
  position,
}: {
  companyId: string;
  network: CompanyMedicalNetworkDto;
  position: number;
}) {
  const { notify } = useToast();
  const save = useSaveMedicalNetwork(companyId);
  const remove = useDeleteMedicalNetwork(companyId);
  const [editing, setEditing] = useState(false);
  const [showingProviders, setShowingProviders] = useState(false);
  const providerCount = network.providers?.length ?? 0;
  const [name, setName] = useState(network.name);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: network.id,
  });

  function commit() {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === network.name) {
      setName(network.name);
      setEditing(false);
      return;
    }
    save.mutate(
      { networkId: network.id, name: trimmed },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => {
          setName(network.name);
          notify(describeError(error, 'the network'), 'error');
        },
      },
    );
  }

  /**
   * Deleting a network does not delete the plans sold on it — they simply stop
   * naming one, which then reads as "not stated". That is still a real change
   * to what those plans say, so the count is put to the employee first.
   */
  function handleDelete() {
    // Variants, not plans: one plan may be sold on two networks, so a plan
    // count would understate what deleting this actually costs.
    const sold = network.variantCount ?? 0;
    if (sold > 0) {
      const variants = `${sold} priced ${sold === 1 ? 'variant is' : 'variants are'}`;
      const ok = window.confirm(
        `${variants} sold on "${network.name}". Deleting it leaves ${sold === 1 ? 'that variant' : 'those variants'} with no network stated. Delete it anyway?`,
      );
      if (!ok) return;
    }

    remove.mutate(
      { networkId: network.id, force: sold > 0 },
      { onError: (error) => notify(describeError(error, 'the network'), 'error') },
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface rounded-(--radius-control) border px-2.5 py-2',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
      )}
    >
      <div className="flex items-center gap-2.5">
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${network.name}`}
        className="text-content-subtle hover:text-content cursor-grab touch-none"
      >
        <IconGrip />
      </button>

      <span className="text-content-subtle w-5 shrink-0 text-sm tabular-nums">{position}.</span>

      {editing ? (
        <Input
          autoFocus
          value={name}
          aria-label={`Rename ${network.name}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              setName(network.name);
              setEditing(false);
            }
          }}
          className="py-1 text-sm"
        />
      ) : (
        <span className="text-content min-w-0 flex-1 truncate text-sm font-medium">
          {network.name}
          {network.variantCount ? (
            <span className="text-content-subtle ml-2 text-xs font-normal">
              {network.variantCount} {network.variantCount === 1 ? 'variant' : 'variants'}
            </span>
          ) : null}
        </span>
      )}

      <button
        type="button"
        onClick={() => setShowingProviders((open) => !open)}
        aria-expanded={showingProviders}
        aria-label={`Provider information for ${network.name}`}
        className="text-content-subtle hover:text-brand-strong shrink-0 rounded-(--radius-control) px-2 py-1 text-xs font-medium"
      >
        {providerCount > 0 ? `${providerCount} provider types` : 'Add providers'}
      </button>

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${network.name}`}
        className="text-content-subtle hover:text-brand-strong shrink-0 rounded-(--radius-control) p-1.5"
      >
        <IconEdit className="size-4" />
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={remove.isPending}
        aria-label={`Delete ${network.name}`}
        className="text-danger hover:bg-danger-soft shrink-0 rounded-(--radius-control) p-1.5"
      >
        <IconTrash className="size-4" />
      </button>
      </div>

      {/* The estate this network gives access to, entered once and read by
          every plan sold on it. */}
      {showingProviders ? (
        <NetworkProviders
          companyId={companyId}
          network={network}
          onClose={() => setShowingProviders(false)}
        />
      ) : null}
    </li>
  );
}

/**
 * Add a network.
 *
 * It lands at the BOTTOM of the ranking: a new network nobody has placed yet
 * appearing above the best one would restate what the company offers. The
 * employee drags it where it belongs.
 */
function NewNetwork({ companyId }: { companyId: string }) {
  const create = useCreateMedicalNetwork(companyId);
  const { notify } = useToast();
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') return;

    create.mutate(
      { name: trimmed },
      {
        onSuccess: () => setName(''),
        onError: (error) => notify(describeError(error, 'the network'), 'error'),
      },
    );
  }

  return (
    <div className="border-border-subtle mt-2 flex items-center gap-2 border-t pt-3">
      <Input
        value={name}
        placeholder="Add a medical network…"
        aria-label="New medical network"
        disabled={create.isPending}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        className="py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={submit}
        disabled={create.isPending || name.trim() === ''}
        className="text-brand-strong hover:bg-brand-soft shrink-0 rounded-(--radius-control) px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
