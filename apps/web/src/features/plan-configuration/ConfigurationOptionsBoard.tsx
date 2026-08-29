import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ALTERNATIVE_VALUE_KEY,
  UMBRELLA_BENEFIT_LABEL,
  benefitTypeLabel,
  type CustomerTypeId,
  type InsuranceOptionDto,
  type PlanOptionDto,
  type PlanOptionValueDto,
} from '@aggregator/shared';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  IconAdd,
  IconEdit,
  IconGrip,
  IconLayers,
  IconShield,
  IconTrash,
  Input,
  describeError,
  useToast,
} from '@/components/ui';
import {
  isOptimisticPlanOption,
  useAddPlanOption,
  useDeleteInsuranceOption,
  useRemovePlanOption,
  useReorderPlanOptions,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { EditBenefitDialog } from './EditBenefitDialog';
import { NewBenefitDialog } from './NewBenefitDialog';
import { BenefitConditions } from './BenefitConditions';
import { appliesToCustomerType, revealedInputs } from './settings';
import { PlanOptionSettingChoices } from './PlanOptionSettingChoices';
import {
  PlanOptionNoteInline,
  PlanOptionValueInline,
  valueAsText,
} from './PlanOptionValuesForm';

/** Prefix distinguishing a catalogue item from an already-attached benefit. */
const AVAILABLE = 'available:';
const DROP_ZONE = 'plan-coverage-drop-zone';

/**
 * A benefit on the configuration together with the sub-benefits it heads.
 *
 * The API returns one flat list — every attachment is an ordinary row — and
 * this is where it becomes the tree the business describes. A sub-benefit whose
 * group is not attached stands on its own rather than disappearing.
 */
interface CoverageGroup {
  row: PlanOptionDto;
  children: PlanOptionDto[];
}

function groupAttached(attached: PlanOptionDto[]): CoverageGroup[] {
  const attachedOptionIds = new Set(attached.map((item) => item.optionId));

  const groups: CoverageGroup[] = [];
  const byOptionId = new Map<string, CoverageGroup>();

  for (const item of attached) {
    // A sub-benefit is rendered inside its group, never beside it.
    if (item.parentOptionId && attachedOptionIds.has(item.parentOptionId)) continue;
    const group: CoverageGroup = { row: item, children: [] };
    groups.push(group);
    byOptionId.set(item.optionId, group);
  }

  for (const item of attached) {
    if (!item.parentOptionId) continue;
    byOptionId.get(item.parentOptionId)?.children.push(item);
  }

  return groups;
}

/** Every attached row, groups first and their parts directly after them. */
const flattenGroups = (groups: CoverageGroup[]): PlanOptionDto[] =>
  groups.flatMap((group) => [group.row, ...group.children]);

/**
 * Drag benefits from the catalogue into this configuration's coverage,
 * reorder them, and set their values.
 *
 * A group of benefits and its parts move as one: dropping "Life & Accident
 * Coverage" brings death, disability and the rest with it, each with its own
 * value to fill in here.
 *
 * Dragging is purely local: no request is made until the drop, and the drop
 * updates the query cache immediately, so a benefit appears in the coverage
 * list in the same frame the employee releases it. The request that follows is
 * background work, and a failure rolls the cache back (see the mutation hooks).
 */
export function ConfigurationOptionsBoard({
  configurationId,
  customerType,
  attached,
  available,
}: {
  configurationId: string;
  /** Who this configuration is for. Some settings do not apply to everyone. */
  customerType: CustomerTypeId;
  attached: PlanOptionDto[];
  /** The global catalogue — the same list for every company, groups included. */
  available: InsuranceOptionDto[];
}) {
  const { notify } = useToast();
  const addOption = useAddPlanOption(configurationId);
  const removeOption = useRemovePlanOption(configurationId);
  const reorder = useReorderPlanOptions(configurationId);
  const deleteBenefit = useDeleteInsuranceOption();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** The group a new benefit is being created inside, or `null` at top level. */
  const [creating, setCreating] = useState<{ id: string; name: string } | null | undefined>(
    undefined,
  );
  /** The catalogue benefit the employee has asked to delete outright. */
  const [deleting, setDeleting] = useState<InsuranceOptionDto | null>(null);
  /** The catalogue benefit being edited — its name, or what it carries. */
  const [editing, setEditing] = useState<InsuranceOptionDto | null>(null);
  /**
   * What the employee is looking for in the catalogue.
   *
   * Filtered here rather than refetched: the whole catalogue is already in
   * hand, and a request per keystroke would empty and refill the panel under
   * a drag in progress.
   */
  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Derived lists are memoized because they are props of the sortable context
   * and of every row: rebuilding them on each render would hand dnd-kit a new
   * array on every pointer move and rerender the whole list with it.
   */
  const groups = useMemo(() => groupAttached(attached), [attached]);

  const attachedOptionIds = useMemo(
    () => new Set(attached.map((item) => item.optionId)),
    [attached],
  );

  /**
   * The whole catalogue, not just what is addable.
   *
   * A benefit already on this configuration stays listed — greyed, with no Add —
   * because this panel is also where a benefit is DELETED, and a benefit you
   * cannot see is a benefit you cannot get rid of. `addable` is what is still
   * missing from the configuration.
   */
  const catalogue = useMemo(
    () =>
      available.map((option) => ({
        option,
        addableChildren: (option.children ?? []).filter(
          (child) => !attachedOptionIds.has(child.id),
        ),
        isAttached: attachedOptionIds.has(option.id),
      })),
    [attachedOptionIds, available],
  );

  /**
   * What the search leaves.
   *
   * A GROUP SURVIVES ITS OWN PARTS: searching "death" must show the group that
   * holds Death (Natural), or the result is a sub-benefit floating with no way
   * to tell what it belongs to — and no way to add it, since it is added
   * through its group.
   */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return catalogue;

    return catalogue.filter(
      (entry) =>
        entry.option.name.toLowerCase().includes(needle) ||
        (entry.option.children ?? []).some((child) =>
          child.name.toLowerCase().includes(needle),
        ),
    );
  }, [catalogue, search]);

  /** Only groups reorder; their parts stay with the group that heads them. */
  const sortableIds = useMemo(() => groups.map((group) => group.row.id), [groups]);

  /**
   * Which group each sub-benefit belongs to, by name.
   *
   * A sub-benefit whose group is not on this configuration renders at the top
   * level — removing the heading leaves its parts exactly where they were — so
   * the row says where it comes from rather than appearing from nowhere.
   */
  const groupNameByOptionId = useMemo(() => {
    const names = new Map<string, string>();
    for (const option of available) {
      for (const child of option.children ?? []) names.set(child.id, option.name);
    }
    return names;
  }, [available]);

  const attach = useCallback(
    (option: InsuranceOptionDto, rows: InsuranceOptionDto[]) => {
      addOption.mutate(
        { option, rows },
        {
          onSuccess: () => notify(`${option.name} was added to this configuration.`),
          // The cache has already been put back; say why the row disappeared.
          onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
        },
      );
    },
    [addOption, notify],
  );

  /** Dropping a group attaches it with everything under it. */
  const attachWithGroup = useCallback(
    (option: InsuranceOptionDto) => attach(option, [option, ...(option.children ?? [])]),
    [attach],
  );

  /** Adding one part of a group brings the group's heading with it. */
  const attachChild = useCallback(
    (parent: InsuranceOptionDto, child: InsuranceOptionDto) => attach(child, [parent, child]),
    [attach],
  );

  /**
   * Delete a benefit from the catalogue.
   *
   * `force` is sent only when the employee has been told what depends on it —
   * the confirm dialog states the number of configurations and sub-benefits
   * that go with it, so the API's refusal is never what they find out from.
   */
  const confirmDelete = useCallback(() => {
    if (!deleting) return;
    const dependants = countDependants(deleting);

    deleteBenefit.mutate(
      { id: deleting.id, force: dependants.total > 0 },
      {
        onSuccess: () => {
          notify(`${deleting.name} was deleted.`);
          setDeleting(null);
        },
        onError: (error) => {
          notify(describeError(error, 'the benefit'), 'error');
          setDeleting(null);
        },
      },
    );
  }, [deleteBenefit, deleting, notify]);

  const remove = useCallback(
    (planOptionId: string, optionName: string) => {
      removeOption.mutate(planOptionId, {
        onSuccess: () => notify(`${optionName} was removed.`),
        onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
      });
    },
    [notify, removeOption],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggingId(null);
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Catalogue item dropped onto the coverage list.
      if (activeId.startsWith(AVAILABLE)) {
        const droppedInside = overId === DROP_ZONE || sortableIds.includes(overId);
        if (!droppedInside) return;
        const optionId = activeId.slice(AVAILABLE.length);
        const option = available.find((item) => item.id === optionId);
        if (option) attachWithGroup(option);
        return;
      }

      // Reordering within the coverage list.
      if (activeId === overId) return;
      const from = sortableIds.indexOf(activeId);
      const to = sortableIds.indexOf(overId);
      if (from === -1 || to === -1) return;

      // The server is sent every row, so a group's parts follow it.
      const ordered = flattenGroups(arrayMove(groups, from, to)).map((item) => item.id);
      reorder.mutate(ordered, {
        onError: (error) => notify(describeError(error, 'the benefit order'), 'error'),
      });
    },
    [attachWithGroup, available, groups, notify, reorder, sortableIds],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => setDraggingId(String(event.active.id)),
    [],
  );
  const handleDragCancel = useCallback(() => setDraggingId(null), []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        {/* Plan coverage — the main column on desktop, second on mobile. */}
        <Card className="order-last lg:order-first">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Plan coverage
                <Badge tone="brand">{attached.length}</Badge>
              </span>
            }
            description="Benefits included in this configuration, in display order."
            icon={<IconShield className="size-5" />}
          />
          <CardBody>
            <CoverageDropZone isEmpty={groups.length === 0} isDragging={draggingId !== null}>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {groups.map((group) => (
                    <AttachedBenefit
                      key={group.row.id}
                      planOption={group.row}
                      customerType={customerType}
                      subBenefits={group.children}
                      groupName={
                        group.row.parentOptionId
                          ? groupNameByOptionId.get(group.row.optionId)
                          : undefined
                      }
                      onRemove={remove}
                      onAddSubBenefit={setCreating}
                    />
                  ))}
                </div>
              </SortableContext>
            </CoverageDropZone>
          </CardBody>
        </Card>

        {/* Available benefits — a sticky side panel on desktop. */}
        <Card className="order-first lg:order-last lg:sticky lg:top-8">
          <CardHeader
            title="Available benefits"
            description="Drag onto the plan, or use Add. Delete removes a benefit from every plan."
            icon={<IconLayers className="size-5" />}
          />
          <CardBody className="space-y-2">
            {catalogue.length === 0 ? null : (
              <Input
                type="search"
                value={search}
                aria-label="Search benefits"
                placeholder="Search benefits…"
                onChange={(event) => setSearch(event.target.value)}
                className="py-1.5 text-sm"
              />
            )}

            {catalogue.length === 0 ? (
              <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-xs">
                No benefits exist yet. Create the first one below — it will be available to every
                company.
              </p>
            ) : visible.length === 0 ? (
              <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-xs">
                No benefit matches “{search.trim()}”. Create it below — it will be available to
                every company.
              </p>
            ) : (
              visible.map((entry) => (
                <AvailableBenefit
                  key={entry.option.id}
                  option={entry.option}
                  subBenefits={entry.addableChildren}
                  isAttached={entry.isAttached}
                  onAdd={attachWithGroup}
                  onAddChild={attachChild}
                  onAddSubBenefit={setCreating}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))
            )}

            <Button variant="soft" fullWidth className="mt-3" onClick={() => setCreating(null)}>
              <IconAdd className="size-4" />
              New benefit
            </Button>

            <p className="text-content-subtle mt-2 text-center text-[0.7rem] leading-relaxed">
              Benefits are shared by every company. Only their values are set here.
            </p>
          </CardBody>
        </Card>
      </div>

      {creating !== undefined ? (
        <NewBenefitDialog
          {...(creating ? { parent: creating } : {})}
          onClose={() => setCreating(undefined)}
        />
      ) : null}

      {editing ? <EditBenefitDialog benefit={editing} onClose={() => setEditing(null)} /> : null}

      {/* Deleting a benefit is not deleting it from this plan — it leaves the
          catalogue for every company, so the dialog spells out the damage. */}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        busy={deleteBenefit.isPending}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete this benefit?'}
        description={deleting ? describeDeletion(deleting) : ''}
        confirmLabel={
          deleting && countDependants(deleting).total > 0 ? 'Delete everywhere' : 'Delete'
        }
        onConfirm={confirmDelete}
      />
    </DndContext>
  );
}

/**
 * What a benefit takes with it: its sub-benefits, and the configurations
 * carrying it.
 *
 * The benefit's OWN usage is the configuration count, never the sum across the
 * group: a group and its parts are attached together, so adding the children's
 * counts would report the same configuration several times over.
 */
function countDependants(option: InsuranceOptionDto): {
  subBenefits: number;
  configurations: number;
  total: number;
} {
  const subBenefits = (option.children ?? []).length;
  const configurations = option.usageCount ?? 0;
  return { subBenefits, configurations, total: subBenefits + configurations };
}

/** The consequence of the deletion, in the employee's own terms. */
function describeDeletion(option: InsuranceOptionDto): string {
  const { subBenefits, configurations } = countDependants(option);

  const takes = [
    subBenefits > 0
      ? `${subBenefits} sub-benefit${subBenefits === 1 ? '' : 's'} filed under it`
      : null,
    configurations > 0
      ? `${configurations} plan configuration${configurations === 1 ? '' : 's'} that carr${configurations === 1 ? 'ies' : 'y'} it`
      : null,
  ].filter(Boolean);

  if (takes.length === 0) {
    return 'This removes the benefit from the catalogue for every company. Nothing is using it, and it cannot be undone.';
  }

  return `This removes the benefit from the catalogue for every company, along with ${takes.join(' and ')}. Their recorded values are lost and this cannot be undone. To take it off this configuration only, use the remove button on its row instead.`;
}

function CoverageDropZone({
  children,
  isEmpty,
  isDragging,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ZONE });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-(--radius-card) border-2 border-dashed p-3 transition-colors sm:p-4',
        isOver
          ? 'border-brand bg-brand-soft'
          : isDragging
            ? 'border-brand-border bg-brand-soft/40'
            : 'border-border-subtle bg-surface-muted/40',
      )}
    >
      {isEmpty ? (
        <div className="py-12 text-center">
          <span className="bg-surface text-content-subtle mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl">
            <IconShield className="size-5" />
          </span>
          <p className="text-content text-sm font-medium">Drag benefits here</p>
          <p className="text-content-subtle mt-1 text-xs">
            Or press Add on a benefit in the panel.
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * A catalogue entry.
 *
 * The card itself is the draggable item, so the employee grabs the benefit
 * rather than a handle beside it. dnd-kit's attributes make it keyboard
 * operable, and Add stays as the pointer-free path. A group lists the parts it
 * would bring with it, each addable on its own.
 */
const AvailableBenefit = memo(function AvailableBenefit({
  option,
  subBenefits,
  isAttached,
  onAdd,
  onAddChild,
  onAddSubBenefit,
  onEdit,
  onDelete,
}: {
  option: InsuranceOptionDto;
  /** Sub-benefits not yet on this configuration — the addable ones. */
  subBenefits: InsuranceOptionDto[];
  /** True when the benefit itself is already on this configuration. */
  isAttached: boolean;
  onAdd: (option: InsuranceOptionDto) => void;
  onAddChild: (parent: InsuranceOptionDto, child: InsuranceOptionDto) => void;
  onAddSubBenefit: (parent: { id: string; name: string }) => void;
  onEdit: (option: InsuranceOptionDto) => void;
  onDelete: (option: InsuranceOptionDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${AVAILABLE}${option.id}`,
    disabled: isAttached,
  });

  /** Every part of a group is listed, so any of them can be deleted. */
  const children = option.children ?? [];

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'border-border-subtle bg-surface hover:border-brand-border rounded-(--radius-control) border transition-colors',
        isDragging && 'opacity-50 shadow-(--shadow-raised)',
        isAttached && 'bg-surface-muted/40',
      )}
    >
      <div
        {...(isAttached ? {} : listeners)}
        {...attributes}
        aria-label={isAttached ? undefined : `Drag ${option.name}`}
        className={cn(
          'flex items-center gap-1 p-3',
          isAttached ? 'cursor-default' : 'cursor-grab touch-none',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="text-content block truncate text-sm font-medium">{option.name}</span>
          <span className="text-content-subtle block text-xs">
            {isAttached
              ? 'On this configuration'
              : option.isUmbrella
                ? `${UMBRELLA_BENEFIT_LABEL} · ${children.length}`
                : benefitTypeLabel(option.fields)}
          </span>
        </span>

        {/* Named per benefit: several Add buttons share this list. */}
        {isAttached ? null : (
          <button
            type="button"
            onClick={() => onAdd(option)}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={`Add ${option.name}`}
            className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) p-1.5"
          >
            <IconAdd className="size-4" />
          </button>
        )}

        {/* Edits the benefit itself — name and what it carries. It is global,
            so every plan that carries it follows. */}
        <button
          type="button"
          onClick={() => onEdit(option)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Edit ${option.name}`}
          title={`Edit ${option.name} — renames it everywhere`}
          className="text-content-subtle hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-1.5"
        >
          <IconEdit className="size-4" />
        </button>

        {/* Deletes the benefit itself, everywhere — not just from this plan. */}
        <button
          type="button"
          onClick={() => onDelete(option)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Delete ${option.name}`}
          title={`Delete ${option.name} from every plan`}
          className="text-content-subtle hover:bg-danger-soft hover:text-danger rounded-(--radius-control) p-1.5"
        >
          <IconTrash className="size-4" />
        </button>
      </div>

      {option.isUmbrella ? (
        <div className="border-border-subtle space-y-1 border-t px-3 py-2">
          {children.map((child) => {
            const addable = subBenefits.some((item) => item.id === child.id);
            return (
              <div key={child.id} className="flex items-center gap-1">
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-xs',
                      addable ? 'text-content-muted' : 'text-content-subtle',
                    )}
                  >
                    {child.name}
                  </span>
                </span>

                {addable ? (
                  <button
                    type="button"
                    onClick={() => onAddChild(option, child)}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label={`Add ${child.name}`}
                    className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) p-1"
                  >
                    <IconAdd className="size-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onEdit(child)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={`Edit ${child.name}`}
                  title={`Edit ${child.name} — renames it everywhere`}
                  className="text-content-subtle hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-1"
                >
                  <IconEdit className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(child)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={`Delete ${child.name}`}
                  title={`Delete ${child.name} from every plan`}
                  className="text-content-subtle hover:bg-danger-soft hover:text-danger rounded-(--radius-control) p-1"
                >
                  <IconTrash className="size-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => onAddSubBenefit({ id: option.id, name: option.name })}
            onPointerDown={(event) => event.stopPropagation()}
            className="text-brand-strong hover:bg-brand-soft w-full rounded-(--radius-control) px-1 py-1 text-left text-xs font-semibold"
          >
            + New benefit in this group
          </button>
        </div>
      ) : null}
    </div>
  );
});

/**
 * An attached benefit: sortable, removable, with its value on the row.
 *
 * A group renders its parts beneath it, indented, each an ordinary benefit row
 * with its own value and its own remove. Removing the group removes them too —
 * the API applies that rule, so it cannot be got round by another client.
 *
 * dnd-kit rerenders every sortable on each pointer move, so this component is
 * kept to markup only. The value control below it is memoized on primitive
 * props and sits that storm out — the reason a drag stays smooth however many
 * benefits are attached.
 */
const AttachedBenefit = memo(function AttachedBenefit({
  planOption,
  customerType,
  subBenefits,
  groupName,
  onRemove,
  onAddSubBenefit,
}: {
  planOption: PlanOptionDto;
  /** Who this configuration is for — some settings do not apply to everyone. */
  customerType: CustomerTypeId;
  subBenefits: PlanOptionDto[];
  /** Set when this row is a sub-benefit whose group is not attached here. */
  groupName?: string | undefined;
  onRemove: (planOptionId: string, optionName: string) => void;
  onAddSubBenefit: (parent: { id: string; name: string }) => void;
}) {
  // A row the server has not confirmed yet has no id to reorder or save against.
  const pending = isOptimisticPlanOption(planOption);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: planOption.id,
    disabled: pending,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface rounded-(--radius-card) border p-3',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
        pending && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Reorder ${planOption.optionName}`}
          className="text-content-subtle hover:text-content cursor-grab touch-none"
        >
          <IconGrip />
        </button>

        <span className="min-w-0 flex-1">
          <span className="text-content block truncate font-semibold">{planOption.optionName}</span>
          <span className="text-content-subtle block text-xs">
            {planOption.isUmbrella
              ? `${UMBRELLA_BENEFIT_LABEL} · ${subBenefits.length}`
              : groupName
                ? `${benefitTypeLabel(planOption.values)} · from ${groupName}`
                : benefitTypeLabel(planOption.values)}
          </span>
        </span>

        <BenefitValue planOption={planOption} pending={pending} />

        <button
          type="button"
          onClick={() => onRemove(planOption.id, planOption.optionName)}
          aria-label={`Remove ${planOption.optionName}`}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-2"
        >
          <IconTrash className="size-4" />
        </button>
      </div>

      {/* Core settings beyond the figure already beside the name: a benefit
          asks several questions at once, and every one of them stays visible. */}
      {planOption.isUmbrella ? null : (
        <BenefitCoreFields
          planOption={planOption}
          customerType={customerType}
          disabled={pending}
        />
      )}

      {/* A group holds no cover of its own, so it asks nothing. */}
      {planOption.isUmbrella ? null : (
        <div className="mt-2 space-y-1 pl-6">
          {/* Everything the document only sometimes states. */}
          <BenefitConditions
            planOptionId={planOption.id}
            planConfigurationId={planOption.planConfigurationId}
            optionName={planOption.optionName}
            conditions={planOption.values.filter(
              (value) => isCondition(value) && appliesToCustomerType(value, customerType),
            )}
            customerType={customerType}
            disabled={pending}
          />
          <PlanOptionNoteInline
            planOptionId={planOption.id}
            planConfigurationId={planOption.planConfigurationId}
            optionName={planOption.optionName}
            note={planOption.note}
            disabled={pending}
          />
        </div>
      )}

      {planOption.isUmbrella ? (
        <div className="border-border-subtle mt-3 space-y-3 border-l-2 pl-3">
          {subBenefits.map((child) => (
            <div key={child.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="text-content block truncate text-sm font-medium">
                    {child.optionName}
                  </span>
                  <span className="text-content-subtle block text-xs">
                    {benefitTypeLabel(child.values)}
                  </span>
                </span>

                <BenefitValue planOption={child} pending={isOptimisticPlanOption(child)} />

                <button
                  type="button"
                  onClick={() => onRemove(child.id, child.optionName)}
                  aria-label={`Remove ${child.optionName}`}
                  className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-1.5"
                >
                  <IconTrash className="size-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <BenefitConditions
                  planOptionId={child.id}
                  planConfigurationId={child.planConfigurationId}
                  optionName={child.optionName}
                  conditions={child.values.filter(
                    (value) => isCondition(value) && appliesToCustomerType(value, customerType),
                  )}
                  customerType={customerType}
                  disabled={isOptimisticPlanOption(child)}
                />
                <PlanOptionNoteInline
                  planOptionId={child.id}
                  planConfigurationId={child.planConfigurationId}
                  optionName={child.optionName}
                  note={child.note}
                  disabled={isOptimisticPlanOption(child)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              onAddSubBenefit({ id: planOption.optionId, name: planOption.optionName })
            }
            className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) px-1.5 py-1 text-xs font-semibold"
          >
            + Add a benefit to this group
          </button>
        </div>
      ) : null}

    </div>
  );
});

/**
 * Split a benefit's values into the one it mainly carries and the alternative
 * it may be quoted as instead.
 *
 * Told apart by the alternative's stable key rather than by position, so a
 * benefit defined before alternatives existed still reads correctly. Anything
 * else — a benefit built through the general API with several fields — is
 * neither, and keeps its full form below the row.
 */
/**
 * A setting the document only sometimes states.
 *
 * Told apart by the API rather than guessed at here: a condition is a toggle,
 * and its input appears only once an employee says the document mentions it.
 */
const isCondition = (value: PlanOptionValueDto) => value.isOptional;

/**
 * The core settings a benefit asks for, beyond the figure already shown beside
 * its name.
 *
 * Always visible, because a core field is something the documents state as a
 * matter of course — a dental limit, a coverage percentage, the scope of
 * procedures. Each box saves itself, and each may be left EMPTY: that reads as
 * "the document does not say", and never as zero.
 */
function BenefitCoreFields({
  planOption,
  customerType,
  disabled,
}: {
  planOption: PlanOptionDto;
  customerType: CustomerTypeId;
  disabled: boolean;
}) {
  const { main, alternative, managed } = splitValues(planOption);

  /**
   * Skip only what the row ALREADY shows.
   *
   * The figure beside the benefit's name is rendered by `BenefitValue`, and
   * only when the benefit carries the one value it manages. A benefit with
   * several core fields shows none of them up there — so excluding the first
   * one here regardless would make it disappear from the card entirely.
   */
  const shownOnRow = managed
    ? new Set([main?.optionFieldId, alternative?.optionFieldId])
    : new Set<string | undefined>();

  const rest = planOption.values.filter(
    (value) =>
      !value.isOptional &&
      !shownOnRow.has(value.optionFieldId) &&
      appliesToCustomerType(value, customerType),
  );
  if (rest.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 pl-6">
      {rest.flatMap((value) => [
        <CoreField
          key={value.optionFieldId}
          planOption={planOption}
          value={value}
          disabled={disabled}
        />,
        /**
         * What the chosen answer asks for next.
         *
         * "Other" is not an answer on its own — it means "none of these, and
         * here is what it actually is" — so choosing it reveals the box that
         * says. The same mechanism reveals the procedure checklist under
         * "Specific procedures".
         */
        ...revealedInputs(value, customerType).map((input) => (
          <CoreField
            key={input.optionFieldId}
            planOption={planOption}
            value={input}
            disabled={disabled}
          />
        )),
      ])}
    </div>
  );
}

/** One labelled box, saving itself. Blank means the document does not say. */
function CoreField({
  planOption,
  value,
  disabled,
}: {
  planOption: PlanOptionDto;
  value: PlanOptionValueDto;
  disabled: boolean;
}) {
  if (value.dataType === 'MULTI') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-content-subtle text-xs">{value.fieldLabel}</span>
        <PlanOptionSettingChoices
          planOptionId={planOption.id}
          planConfigurationId={planOption.planConfigurationId}
          optionName={planOption.optionName}
          value={value}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-content-subtle text-xs">
        {value.fieldLabel}
        {value.isRequired ? <span className="text-danger ml-0.5">*</span> : null}
      </span>
      <PlanOptionValueInline
        planOptionId={planOption.id}
        planConfigurationId={planOption.planConfigurationId}
        optionName={`${planOption.optionName} ${value.fieldLabel}`}
        optionFieldId={value.optionFieldId}
        dataType={value.dataType}
        unit={value.unit}
        value={value.value === null ? '' : String(value.value)}
        {...(value.choices ? { choices: value.choices } : {})}
        disabled={disabled}
      />
    </label>
  );
}

function splitValues(planOption: PlanOptionDto): {
  main: PlanOptionValueDto | undefined;
  alternative: PlanOptionValueDto | undefined;
  managed: boolean;
} {
  // Core settings only: a condition is never the figure on the row.
  const core = planOption.values.filter((value) => !value.isOptional);
  const alternative = core.find((value) => value.fieldKey === ALTERNATIVE_VALUE_KEY);
  const main = core.find((value) => value.fieldKey !== ALTERNATIVE_VALUE_KEY);
  const managed = core.length === (alternative ? 2 : 1);
  return { main, alternative, managed };
}

/**
 * What a benefit is worth on this configuration: its value, the alternative it
 * may be quoted as instead, and the remark that qualifies either.
 *
 * The two figures read as one statement — "800 EGP or 80%" — which is how the
 * plan documents write them, so they sit on one line with the word between
 * them rather than in separate fields.
 */
function BenefitValue({ planOption, pending }: { planOption: PlanOptionDto; pending: boolean }) {
  const { main, alternative, managed } = splitValues(planOption);
  if (!main || !managed) return null;

  return (
    <span className="flex items-center gap-2">
      <PlanOptionValueInline
        planOptionId={planOption.id}
        planConfigurationId={planOption.planConfigurationId}
        optionName={planOption.optionName}
        optionFieldId={main.optionFieldId}
        dataType={main.dataType}
        unit={main.unit}
        value={valueAsText(main)}
        {...(main.choices ? { choices: main.choices } : {})}
        disabled={pending}
      />

      {alternative ? (
        <>
          <span className="text-content-subtle shrink-0 text-xs font-semibold uppercase">or</span>
          <PlanOptionValueInline
            planOptionId={planOption.id}
            planConfigurationId={planOption.planConfigurationId}
            optionName={`${planOption.optionName} alternative`}
            optionFieldId={alternative.optionFieldId}
            dataType={alternative.dataType}
            unit={alternative.unit}
            value={valueAsText(alternative)}
            {...(alternative.choices ? { choices: alternative.choices } : {})}
            disabled={pending}
          />
        </>
      ) : null}
    </span>
  );
}
