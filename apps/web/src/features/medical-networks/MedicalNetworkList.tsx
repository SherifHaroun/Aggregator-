import {
  PROVIDER_LIST_ACCEPT,
  PROVIDER_LIST_DOWNLOAD_LABEL,
  PROVIDER_LIST_MAX_BYTES,
  type MedicalNetworkDto,
  type ProviderListVersionDto,
} from '@aggregator/shared';
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
import { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  IconDownload,
  IconEdit,
  IconGlobe,
  IconGrip,
  IconTrash,
  IconUpload,
  Input,
  describeError,
  useToast,
} from '@/components/ui';
import {
  useClearProviderList,
  useCreateMedicalNetwork,
  useDeleteMedicalNetwork,
  useMedicalNetworks,
  useReorderMedicalNetworks,
  useSaveMedicalNetwork,
  useUploadProviderList,
} from '@/features/insurance-data/insurance-data.api';
import { providerListUrl, providerListVersionUrl } from '@/lib/api-url';
import { cn } from '@/lib/cn';

/**
 * THE SHARED LIST OF MEDICAL NETWORKS, and the provider list each one carries.
 *
 * A network is not a benefit and belongs to no company: GlobeMed is one
 * network however many insurers sell on it. A plan picks one from this list,
 * every variant of the plan inherits it, and the customer is told its name and
 * offered its provider list — never which tier they bought.
 *
 * THE FILE IS THE INSURER'S OWN. It arrives as a spreadsheet, in a layout that
 * differs by insurer and changes every few months, so it is kept exactly as
 * sent and replaced whole. Replacing it here changes what every plan on the
 * network hands out from that moment, including from PDFs already sent — they
 * point at the network, not at a file.
 *
 * Every change saves itself, like the rest of the application.
 */
export function MedicalNetworkList() {
  const networks = useMedicalNetworks({ includeInactive: true });
  const reorder = useReorderMedicalNetworks();
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
        description="Shared by every company. A plan picks one; its customers are told the name and can download the provider list."
        icon={<IconGlobe className="size-5" />}
      />
      <CardBody className="space-y-2">
        {networks.isPending ? (
          <p className="text-content-subtle px-1 py-2 text-sm">Loading…</p>
        ) : networks.error ? (
          <p role="alert" className="text-danger px-1 py-2 text-sm">
            {describeError(networks.error, 'the medical networks')}
          </p>
        ) : ordered.length === 0 ? (
          <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-sm">
            No networks yet. Add the ones your plans are sold on — GlobeMed, AXA — then upload each
            one’s provider list.
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
                  <NetworkRow key={network.id} network={network} position={index + 1} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <NewNetwork />
      </CardBody>
    </Card>
  );
}

/** When the current file was put on record, as a person reads a date. */
function updatedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One network: drag to rank it, rename it, replace its file, or remove it. */
function NetworkRow({ network, position }: { network: MedicalNetworkDto; position: number }) {
  const { notify } = useToast();
  const save = useSaveMedicalNetwork();
  const remove = useDeleteMedicalNetwork();
  const [editing, setEditing] = useState(false);
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
   * to what those plans tell a customer, so the count is put to the employee
   * first.
   */
  function handleDelete() {
    const sold = network.planCount ?? 0;
    if (sold > 0) {
      const ok = window.confirm(
        `${sold} ${sold === 1 ? 'plan is' : 'plans are'} sold on "${network.name}". Deleting it leaves ${sold === 1 ? 'that plan' : 'those plans'} with no network stated. Delete it anyway?`,
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
            {network.planCount ? (
              <span className="text-content-subtle ml-2 text-xs font-normal">
                {network.planCount} {network.planCount === 1 ? 'plan' : 'plans'}
              </span>
            ) : null}
            {network.isActive ? null : (
              <Badge tone="neutral" className="ml-2">
                Retired
              </Badge>
            )}
          </span>
        )}

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

      <ProviderListRow network={network} />
    </li>
  );
}

/**
 * Every file the network has ever held, newest first.
 *
 * Kept because the question "what was the list in May?" gets asked, and the
 * answer is the file itself. Each is downloadable by its own address; the
 * current one is marked, and only the current one is ever put in a PDF.
 */
function ProviderListHistory({
  network,
  versions,
}: {
  network: MedicalNetworkDto;
  versions: ProviderListVersionDto[];
}) {
  return (
    <ol aria-label={`Provider list history for ${network.name}`} className="mt-1.5 space-y-1 pl-10">
      {versions.map((version) => (
        <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <a
            href={providerListVersionUrl(network.id, version.id)}
            className="text-brand-strong hover:bg-brand-soft inline-flex items-center gap-1 rounded-(--radius-control) px-1.5 py-0.5 font-medium"
          >
            <IconDownload className="size-3.5" />
            {version.fileName}
          </a>
          <span className="text-content-subtle">
            {updatedLabel(version.uploadedAt) ?? version.uploadedAt}
          </span>
          {version.isCurrent ? <Badge tone="success">Current</Badge> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The provider list: what is on file, when it was put there, and the controls
 * to replace or remove it.
 *
 * REPLACES WHOLE. The insurer publishes a complete list each time, so there is
 * nothing to merge, and the old file is gone the moment the new one is on
 * record.
 */
function ProviderListRow({ network }: { network: MedicalNetworkDto }) {
  const { notify } = useToast();
  const upload = useUploadProviderList();
  const clear = useClearProviderList();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > PROVIDER_LIST_MAX_BYTES) {
      notify(
        `That file is ${Math.round(file.size / 1024 / 1024)} MB. The provider list must be under ${Math.round(PROVIDER_LIST_MAX_BYTES / 1024 / 1024)} MB.`,
        'error',
      );
      return;
    }
    upload.mutate(
      { networkId: network.id, file },
      {
        onSuccess: () => notify(`${network.name}: the provider list was replaced.`),
        onError: (error) => notify(describeError(error, 'the provider list'), 'error'),
      },
    );
  }

  function handleClear() {
    const ok = window.confirm(
      `Remove the provider list from "${network.name}"? Plans on this network will have nothing to download until a new one is uploaded.`,
    );
    if (!ok) return;
    clear.mutate(network.id, {
      onError: (error) => notify(describeError(error, 'the provider list'), 'error'),
    });
  }

  const updated = updatedLabel(network.providerListUpdatedAt);
  const busy = upload.isPending || clear.isPending;
  const history = network.providerListHistory ?? [];
  const [showingHistory, setShowingHistory] = useState(false);

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-10 text-xs">
        {network.providerListUrl ? (
          <>
            <a
              href={providerListUrl(network.id)}
              className="text-brand-strong hover:bg-brand-soft inline-flex items-center gap-1 rounded-(--radius-control) px-1.5 py-0.5 font-medium"
            >
              <IconDownload className="size-3.5" />
              {network.providerListFileName ?? PROVIDER_LIST_DOWNLOAD_LABEL}
            </a>
            {updated ? <span className="text-content-subtle">Updated {updated}</span> : null}
          </>
        ) : (
          <span className="text-content-subtle">No provider list yet.</span>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={`${network.providerListUrl ? 'Replace' : 'Upload'} provider list for ${network.name}`}
          className="text-brand-strong hover:bg-brand-soft inline-flex items-center gap-1 rounded-(--radius-control) px-1.5 py-0.5 font-semibold disabled:opacity-50"
        >
          <IconUpload className="size-3.5" />
          {upload.isPending
            ? 'Uploading…'
            : network.providerListUrl
              ? 'Replace file'
              : 'Upload file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PROVIDER_LIST_ACCEPT}
          className="sr-only"
          aria-label={`Provider list file for ${network.name}`}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            // So choosing the same file again still counts as a choice.
            event.target.value = '';
          }}
        />

        {network.providerListUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleClear}
            aria-label={`Remove provider list from ${network.name}`}
            className="text-content-subtle hover:text-danger rounded-(--radius-control) px-1.5 py-0.5 disabled:opacity-50"
          >
            Remove file
          </button>
        ) : null}

        {history.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowingHistory((open) => !open)}
            aria-expanded={showingHistory}
            aria-label={`Provider list history for ${network.name}`}
            className="text-content-subtle hover:text-brand-strong rounded-(--radius-control) px-1.5 py-0.5"
          >
            {showingHistory ? 'Hide history' : `History (${history.length})`}
          </button>
        ) : null}
      </div>
      {showingHistory ? <ProviderListHistory network={network} versions={history} /> : null}
    </>
  );
}

/**
 * Add a network.
 *
 * It lands at the BOTTOM of the list: a network nobody has placed yet
 * appearing above the ones that were would restate what is on offer. The
 * employee drags it where it belongs, then uploads its file.
 */
function NewNetwork() {
  const create = useCreateMedicalNetwork();
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
        placeholder="Add a medical network, e.g. GlobeMed…"
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
