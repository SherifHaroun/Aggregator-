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
  UMBRELLA_BENEFIT_LABEL,
  benefitTypeLabel,
  type InsuranceOptionDto,
  type PlanOptionDto,
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
import { NewBenefitDialog } from './NewBenefitDialog';
import { RenameBenefitDialog } from './RenameBenefitDialog';
import { PlanOptionValueInline, PlanOptionValuesForm, valueAsText } from './PlanOptionValuesForm';

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
  attached,
  available,
}: {
  configurationId: string;
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
  /** The catalogue benefit being renamed. */
  const [renaming, setRenaming] = useState<InsuranceOptionDto | null>(null);

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

  /** Only groups reorder; their parts stay with the group that heads them. */
  const sortableIds = useMemo(() => groups.map((group) => group.row.id), [groups]);

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
                      subBenefits={group.children}
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
            {catalogue.length === 0 ? (
              <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-xs">
                No benefits exist yet. Create the first one below — it will be available to every
                company.
              </p>
            ) : (
              catalogue.map((entry) => (
                <AvailableBenefit
                  key={entry.option.id}
                  option={entry.option}
                  subBenefits={entry.addableChildren}
                  isAttached={entry.isAttached}
                  onAdd={attachWithGroup}
                  onAddChild={attachChild}
                  onAddSubBenefit={setCreating}
                  onRename={setRenaming}
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

      {renaming ? (
        <RenameBenefitDialog benefit={renaming} onClose={() => setRenaming(null)} />
      ) : null}

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
  onRename,
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
  onRename: (option: InsuranceOptionDto) => void;
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

        {/* Renames the benefit itself: it is global, so every plan follows. */}
        <button
          type="button"
          onClick={() => onRename(option)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Rename ${option.name}`}
          title={`Rename ${option.name} everywhere`}
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
                  onClick={() => onRename(child)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={`Rename ${child.name}`}
                  title={`Rename ${child.name} everywhere`}
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
  subBenefits,
  onRemove,
  onAddSubBenefit,
}: {
  planOption: PlanOptionDto;
  subBenefits: PlanOptionDto[];
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

      {planOption.isUmbrella ? (
        <div className="border-border-subtle mt-3 space-y-2 border-l-2 pl-3">
          {subBenefits.map((child) => (
            <div key={child.id} className="flex flex-wrap items-center gap-2">
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

      {/* A benefit with several values keeps its full form below the row. */}
      {planOption.isUmbrella || planOption.values.length <= 1 ? null : (
        <div className="mt-4">
          <PlanOptionValuesForm planOption={planOption} />
        </div>
      )}
    </div>
  );
});

/**
 * The single value a benefit carries, edited inline.
 *
 * A group carries none, and a benefit with several values is edited in the form
 * below its row instead — both render nothing here.
 */
function BenefitValue({ planOption, pending }: { planOption: PlanOptionDto; pending: boolean }) {
  const single = planOption.values.length === 1 ? planOption.values[0] : undefined;
  if (!single) return null;

  return (
    <PlanOptionValueInline
      planOptionId={planOption.id}
      planConfigurationId={planOption.planConfigurationId}
      optionName={planOption.optionName}
      optionFieldId={single.optionFieldId}
      dataType={single.dataType}
      unit={single.unit}
      value={valueAsText(single)}
      disabled={pending}
    />
  );
}
