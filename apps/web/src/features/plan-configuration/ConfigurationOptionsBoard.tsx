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
import { benefitTypeLabel, type InsuranceOptionDto, type PlanOptionDto } from '@aggregator/shared';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  IconAdd,
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
  useRemovePlanOption,
  useReorderPlanOptions,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { NewBenefitDialog } from './NewBenefitDialog';
import { PlanOptionValueInline, PlanOptionValuesForm, valueAsText } from './PlanOptionValuesForm';

/** Prefix distinguishing a catalogue item from an already-attached benefit. */
const AVAILABLE = 'available:';
const DROP_ZONE = 'plan-coverage-drop-zone';

/**
 * Drag benefits from the catalogue into this configuration's coverage,
 * reorder them, and set their percentage.
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
  /** The global catalogue — the same list for every company. */
  available: InsuranceOptionDto[];
}) {
  const { notify } = useToast();
  const addOption = useAddPlanOption(configurationId);
  const removeOption = useRemovePlanOption(configurationId);
  const reorder = useReorderPlanOptions(configurationId);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Derived lists are memoized because they are props of the sortable context
   * and of every row: rebuilding them on each render would hand dnd-kit a new
   * array on every pointer move and rerender the whole list with it.
   */
  const catalogue = useMemo(() => {
    const attachedOptionIds = new Set(attached.map((item) => item.optionId));
    return available.filter((option) => !attachedOptionIds.has(option.id));
  }, [attached, available]);

  const sortableIds = useMemo(() => attached.map((item) => item.id), [attached]);

  const attach = useCallback(
    (option: InsuranceOptionDto) => {
      addOption.mutate(option, {
        onSuccess: () => notify(`${option.name} was added to this configuration.`),
        // The cache has already been put back; say why the row disappeared.
        onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
      });
    },
    [addOption, notify],
  );

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
        const droppedInside = overId === DROP_ZONE || attached.some((item) => item.id === overId);
        if (!droppedInside) return;
        const optionId = activeId.slice(AVAILABLE.length);
        const option = available.find((item) => item.id === optionId);
        if (option) attach(option);
        return;
      }

      // Reordering within the coverage list.
      if (activeId === overId) return;
      const from = sortableIds.indexOf(activeId);
      const to = sortableIds.indexOf(overId);
      if (from === -1 || to === -1) return;

      reorder.mutate(arrayMove(sortableIds, from, to), {
        onError: (error) => notify(describeError(error, 'the benefit order'), 'error'),
      });
    },
    [attach, attached, available, notify, reorder, sortableIds],
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
            <CoverageDropZone isEmpty={attached.length === 0} isDragging={draggingId !== null}>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {attached.map((planOption) => (
                    <AttachedBenefit
                      key={planOption.id}
                      planOption={planOption}
                      onRemove={remove}
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
            description="Drag onto the plan, or use Add."
            icon={<IconLayers className="size-5" />}
          />
          <CardBody className="space-y-2">
            {catalogue.length === 0 ? (
              <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-xs">
                {available.length === 0
                  ? 'No benefits exist yet. Create the first one below — it will be available to every company.'
                  : 'Every available benefit is already on this configuration.'}
              </p>
            ) : (
              catalogue.map((option) => (
                <AvailableBenefit key={option.id} option={option} onAdd={attach} />
              ))
            )}

            <Button variant="soft" fullWidth className="mt-3" onClick={() => setCreating(true)}>
              <IconAdd className="size-4" />
              New benefit
            </Button>

            <p className="text-content-subtle mt-2 text-center text-[0.7rem] leading-relaxed">
              Benefits are shared by every company. Only the percentage is set here.
            </p>
          </CardBody>
        </Card>
      </div>

      {creating ? <NewBenefitDialog onClose={() => setCreating(false)} /> : null}
    </DndContext>
  );
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
 * operable, and Add stays as the pointer-free path.
 */
const AvailableBenefit = memo(function AvailableBenefit({
  option,
  onAdd,
}: {
  option: InsuranceOptionDto;
  onAdd: (option: InsuranceOptionDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${AVAILABLE}${option.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Drag ${option.name}`}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'border-border-subtle bg-surface hover:border-brand-border flex cursor-grab touch-none items-center gap-2 rounded-(--radius-control) border p-3 transition-colors',
        isDragging && 'opacity-50 shadow-(--shadow-raised)',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-content block truncate text-sm font-medium">{option.name}</span>
        <span className="text-content-subtle block text-xs">{benefitTypeLabel(option.fields)}</span>
      </span>

      {/* Named per benefit: several Add buttons share this list. */}
      <button
        type="button"
        onClick={() => onAdd(option)}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Add ${option.name}`}
        className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) p-1.5"
      >
        <IconAdd className="size-4" />
      </button>
    </div>
  );
});

/**
 * An attached benefit: sortable, removable, with its percentage on the row.
 *
 * dnd-kit rerenders every sortable on each pointer move, so this component is
 * kept to markup only. The value control below it is memoized on primitive
 * props and sits that storm out — the reason a drag stays smooth however many
 * benefits are attached.
 */
const AttachedBenefit = memo(function AttachedBenefit({
  planOption,
  onRemove,
}: {
  planOption: PlanOptionDto;
  onRemove: (planOptionId: string, optionName: string) => void;
}) {
  // A row the server has not confirmed yet has no id to reorder or save against.
  const pending = isOptimisticPlanOption(planOption);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: planOption.id,
    disabled: pending,
  });

  /**
   * A benefit carries one value, so it renders inline. Anything else is a
   * record from before the percentage-only workflow and keeps its full form.
   */
  const single = planOption.values.length === 1 ? planOption.values[0] : undefined;

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
            {benefitTypeLabel(planOption.values)}
          </span>
        </span>

        {single ? (
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
        ) : null}

        <button
          type="button"
          onClick={() => onRemove(planOption.id, planOption.optionName)}
          aria-label={`Remove ${planOption.optionName}`}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-2"
        >
          <IconTrash className="size-4" />
        </button>
      </div>

      {single ? null : (
        <div className="mt-4">
          <PlanOptionValuesForm planOption={planOption} />
        </div>
      )}
    </div>
  );
});
