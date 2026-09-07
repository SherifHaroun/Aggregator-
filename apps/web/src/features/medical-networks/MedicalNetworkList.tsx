import {
  PROVIDER_LIST_ACCEPT,
  PROVIDER_LIST_DOWNLOAD_LABEL,
  PROVIDER_LIST_HISTORY_LIMIT,
  PROVIDER_LIST_MAX_BYTES,
  describeFileSize,
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
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Field,
  IconAdd,
  IconChevronRight,
  IconClose,
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
  useDeleteProviderListVersion,
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
 * The list is a set of cards; opening one slides in a panel with everything
 * about that network: the file on offer, the last few issues of it, and the
 * controls to rename, replace, or remove.
 *
 * THE FILE IS THE INSURER'S OWN. It arrives as a spreadsheet, in a layout that
 * differs by insurer and changes every few months, so it is kept exactly as
 * sent and replaced whole. Replacing it here changes what every plan on the
 * network hands out from that moment, including from PDFs already sent — they
 * point at the network, not at a file.
 */
export function MedicalNetworkList() {
  const networks = useMedicalNetworks({ includeInactive: true });
  const reorder = useReorderMedicalNetworks();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  /** The order shown while a drag is saving, so a row stays where it was dropped. */
  const [pending, setPending] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    const list = networks.data ?? [];
    if (!pending) return list;
    const byId = new Map(list.map((network) => [network.id, network]));
    return pending.flatMap((id) => byId.get(id) ?? []);
  }, [networks.data, pending]);

  const selected = ordered.find((network) => network.id === selectedId) ?? null;

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
    <>
      <Card>
        <CardHeader
          title="Medical networks"
          description="Shared by every company. A plan picks one; its customers are told the name and can download the provider list."
          icon={<IconGlobe className="size-5" />}
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <IconAdd className="size-4" />
              Add network
            </Button>
          }
        />
        <CardBody>
          {networks.isPending ? (
            <p className="text-content-subtle px-1 py-2 text-sm">Loading…</p>
          ) : networks.error ? (
            <p role="alert" className="text-danger px-1 py-2 text-sm">
              {describeError(networks.error, 'the medical networks')}
            </p>
          ) : ordered.length === 0 ? (
            <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-8 text-center text-sm">
              No networks yet. Add the ones your plans are sold on — GlobeMed, AXA — then upload
              each one’s provider list.
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
                <ol aria-label="Medical networks" className="space-y-2.5">
                  {ordered.map((network) => (
                    <NetworkCard
                      key={network.id}
                      network={network}
                      selected={network.id === selectedId}
                      onOpen={() => setSelectedId(network.id)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </CardBody>
      </Card>

      {selected ? <NetworkPanel network={selected} onClose={() => setSelectedId(null)} /> : null}

      {adding ? <AddNetworkDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/** "8 Sept 2026", as the screen writes every date. */
function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The network's initials in a soft disc — its mark wherever it appears. */
function NetworkAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand-soft text-brand-strong flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm',
      )}
    >
      {initials || 'N'}
    </span>
  );
}

function plansLabel(count: number | undefined) {
  const n = count ?? 0;
  return `${n} ${n === 1 ? 'plan' : 'plans'}`;
}

// ---------------------------------------------------------------------------
// One card in the list
// ---------------------------------------------------------------------------

function NetworkCard({
  network,
  selected,
  onOpen,
}: {
  network: MedicalNetworkDto;
  selected: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: network.id,
  });
  const updated = dateLabel(network.providerListUpdatedAt);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface hover:border-brand-border flex items-center gap-3 rounded-(--radius-card) border px-3 py-3 transition-colors',
        selected && 'border-brand-border ring-brand-border/40 ring-2',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${network.name}`}
        className="text-content-subtle hover:text-content cursor-grab touch-none"
      >
        <IconGrip />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${network.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <NetworkAvatar name={network.name} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-content truncate text-sm font-semibold">{network.name}</span>
            <Badge tone="brand">{plansLabel(network.planCount)}</Badge>
            {network.isActive ? null : <Badge tone="neutral">Retired</Badge>}
          </span>
          <span className="text-content-subtle mt-0.5 block text-xs">
            {updated ? `Last updated ${updated}` : 'No provider list yet'}
          </span>
        </span>
        <IconChevronRight className="text-content-subtle size-4 shrink-0" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The panel: everything about one network
// ---------------------------------------------------------------------------

function NetworkPanel({ network, onClose }: { network: MedicalNetworkDto; onClose: () => void }) {
  const { notify } = useToast();
  const save = useSaveMedicalNetwork();
  const remove = useDeleteMedicalNetwork();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(network.name);

  useEffect(() => {
    setName(network.name);
  }, [network.name]);

  // Escape closes, as a dialog does.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commitName() {
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
      {
        onSuccess: () => {
          notify(`${network.name} was deleted.`);
          onClose();
        },
        onError: (error) => notify(describeError(error, 'the network'), 'error'),
      },
    );
  }

  const history = network.providerListHistory ?? [];
  const updated = dateLabel(network.providerListUpdatedAt);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${network.name} medical network`}
        className="bg-surface text-content relative flex h-full w-full max-w-lg flex-col shadow-(--shadow-raised)"
      >
        {/* --- header: who this is ---------------------------------------- */}
        <div className="border-border-subtle flex items-start gap-3 border-b px-6 py-5">
          <NetworkAvatar name={network.name} size="lg" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <Input
                autoFocus
                value={name}
                aria-label={`Rename ${network.name}`}
                onChange={(event) => setName(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitName();
                  }
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setName(network.name);
                    setEditing(false);
                  }
                }}
                className="py-1 text-base font-semibold"
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-content truncate text-lg font-bold">{network.name}</h2>
                <Badge tone="brand">{plansLabel(network.planCount)}</Badge>
                {network.isActive ? null : <Badge tone="neutral">Retired</Badge>}
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit ${network.name}`}
                  className="text-content-subtle hover:text-brand-strong rounded-(--radius-control) p-1"
                >
                  <IconEdit className="size-4" />
                </button>
              </div>
            )}
            <p className="text-content-subtle mt-1 text-xs">
              {updated ? `Last updated ${updated}` : 'No provider list yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-content-muted hover:bg-surface-muted hover:text-content shrink-0 rounded-(--radius-control) p-2"
          >
            <IconClose className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <p className="text-content-muted text-sm leading-relaxed">
            {network.description ??
              `${network.name} — the provider list for this network is available below. Every plan sold on it hands out the current file, and every plan updates the moment a new file is uploaded.`}
          </p>

          <ProviderListUploader network={network} />

          {/* --- files & history ------------------------------------------- */}
          <section>
            <h3 className="text-content mb-2 flex items-center gap-2 text-sm font-semibold">
              <IconDownload className="text-brand size-4" />
              Files &amp; history
              <span className="text-content-subtle font-normal">
                · the last {PROVIDER_LIST_HISTORY_LIMIT} issues
              </span>
            </h3>
            {history.length === 0 ? (
              <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-sm">
                No files yet. Upload the insurer’s file above.
              </p>
            ) : (
              <ol aria-label={`Files and history for ${network.name}`} className="space-y-2">
                {history.map((version) => (
                  <ProviderListVersionRow key={version.id} network={network} version={version} />
                ))}
              </ol>
            )}
          </section>

          {/* --- details ----------------------------------------------------- */}
          <section>
            <h3 className="text-content mb-2 flex items-center gap-2 text-sm font-semibold">
              <IconGlobe className="text-brand size-4" />
              Network details
            </h3>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Plans', String(network.planCount ?? 0)],
                ['Files', String(history.length)],
                ['Status', network.isActive ? 'Active' : 'Retired'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-surface-muted/60 rounded-(--radius-control) px-3 py-3 text-center"
                >
                  <dd className="text-content text-lg font-bold">{value}</dd>
                  <dt className="text-content-subtle text-xs">{label}</dt>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* --- footer: the download, and the way out --------------------------- */}
        <div className="border-border-subtle bg-surface-muted/60 flex flex-wrap items-center gap-3 border-t px-6 py-4">
          {network.providerListUrl ? (
            <a
              href={providerListUrl(network.id)}
              className="bg-brand text-content-inverted hover:bg-brand-strong inline-flex flex-1 items-center justify-center gap-2 rounded-(--radius-control) px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <IconDownload className="size-4" />
              {PROVIDER_LIST_DOWNLOAD_LABEL}
            </a>
          ) : (
            <span className="text-content-subtle flex-1 text-sm">Nothing to download yet.</span>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            aria-label={`Delete ${network.name}`}
            className="text-danger hover:bg-danger-soft inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <IconTrash className="size-4" />
            Delete network
          </button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Where the insurer's file goes: drop it, or browse for it.
 *
 * REPLACES WHOLE. The insurer publishes a complete list each time, so there is
 * nothing to merge; the file it replaces moves into the history below.
 */
function ProviderListUploader({ network }: { network: MedicalNetworkDto }) {
  const { notify } = useToast();
  const upload = useUploadProviderList();
  const clear = useClearProviderList();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  function handleClear() {
    const ok = window.confirm(
      `Remove the provider list from "${network.name}"? Plans on this network will have nothing to download until a new one is uploaded. The file stays in the history.`,
    );
    if (!ok) return;
    clear.mutate(network.id, {
      onError: (error) => notify(describeError(error, 'the provider list'), 'error'),
    });
  }

  const busy = upload.isPending || clear.isPending;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex items-center gap-4 rounded-(--radius-card) border-2 border-dashed px-4 py-4 transition-colors',
        dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-muted/40',
      )}
    >
      <span className="bg-brand-soft text-brand flex size-10 shrink-0 items-center justify-center rounded-(--radius-control)">
        <IconUpload className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-content text-sm font-semibold">Provider list</p>
        <p className="text-content-subtle text-xs">
          {upload.isPending
            ? 'Uploading…'
            : 'Drop the insurer’s file here, or browse. Excel, CSV or PDF. Replacing it updates every plan on this network at once.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {network.providerListUrl ? 'Replace file' : 'Upload file'}
        </Button>
        {network.providerListUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleClear}
            aria-label={`Remove provider list from ${network.name}`}
            className="text-content-subtle hover:text-danger text-xs disabled:opacity-50"
          >
            Remove file
          </button>
        ) : null}
      </div>
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
    </div>
  );
}

/**
 * One issue of the list: the file, when it arrived, how big it is, and whether
 * it is the one customers get today. Each downloads by its own address, and a
 * past issue can be dropped; the current one is replaced or removed instead.
 */
function ProviderListVersionRow({
  network,
  version,
}: {
  network: MedicalNetworkDto;
  version: ProviderListVersionDto;
}) {
  const { notify } = useToast();
  const drop = useDeleteProviderListVersion();
  const [menuOpen, setMenuOpen] = useState(false);
  const size = describeFileSize(version.sizeBytes);

  return (
    <li
      aria-label={`${version.fileName}, issue of the provider list`}
      className={cn(
        'border-border-subtle flex items-center gap-3 rounded-(--radius-control) border px-3 py-2.5',
        version.isCurrent && 'bg-brand-soft/40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) text-xs font-bold',
          version.isCurrent
            ? 'bg-success-soft text-success'
            : 'bg-surface-muted text-content-muted',
        )}
      >
        XLS
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={providerListVersionUrl(network.id, version.id)}
          className="text-content hover:text-brand-strong block truncate text-sm font-medium"
        >
          {version.fileName}
        </a>
        <p className="text-content-subtle text-xs">
          Uploaded {dateLabel(version.uploadedAt) ?? version.uploadedAt}
          {size ? ` · ${size}` : ''}
        </p>
      </div>
      {version.isCurrent ? <Badge tone="success">Latest</Badge> : null}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${version.fileName}`}
          className="text-content-subtle hover:bg-surface-muted hover:text-content rounded-(--radius-control) px-2 py-1 text-base leading-none"
        >
          ⋯
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="border-border-subtle bg-surface absolute right-0 z-10 mt-1 min-w-36 rounded-(--radius-control) border py-1 shadow-(--shadow-raised)"
          >
            <a
              role="menuitem"
              href={providerListVersionUrl(network.id, version.id)}
              onClick={() => setMenuOpen(false)}
              className="text-content hover:bg-surface-muted block px-3 py-1.5 text-sm"
            >
              Download
            </a>
            {version.isCurrent ? null : (
              <button
                type="button"
                role="menuitem"
                disabled={drop.isPending}
                onClick={() => {
                  setMenuOpen(false);
                  drop.mutate(
                    { networkId: network.id, versionId: version.id },
                    { onError: (error) => notify(describeError(error, 'the file'), 'error') },
                  );
                }}
                className="text-danger hover:bg-danger-soft block w-full px-3 py-1.5 text-left text-sm"
              >
                Delete
              </button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Adding a network
// ---------------------------------------------------------------------------

/**
 * A network is a name. It lands at the BOTTOM of the list — a network nobody
 * has placed yet appearing above the ones that were would restate what is on
 * offer — and its file is uploaded from its panel.
 */
function AddNetworkDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateMedicalNetwork();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter the network’s name.');
      return;
    }
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (created) => {
          notify(`${created.name} was added. Open it to upload its provider list.`);
          onClose();
        },
        onError: (failure) => setError(describeError(failure, 'the network')),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a medical network"
      description="The name customers will see on their plan. Its provider list is uploaded next, from the network’s panel."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add network'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Callout tone="danger" title="Could not add the network">
            {error}
          </Callout>
        ) : null}
        <Field label="Network name" required>
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={name}
              placeholder="e.g. GlobeMed"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
