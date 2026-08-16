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
import type { InsuranceOptionDto, PlanOptionDto } from '@aggregator/shared';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
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
  useAddPlanOption,
  useRemovePlanOption,
  useReorderPlanOptions,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { OptionEditorDialog } from './OptionEditorDialog';
import { PlanOptionValuesForm } from './PlanOptionValuesForm';

/** Prefix distinguishing a catalogue item from an already-attached benefit. */
const AVAILABLE = 'available:';
const DROP_ZONE = 'plan-coverage-drop-zone';

/**
 * Drag benefits from the catalogue into this configuration's coverage,
 * reorder them, and set their values.
 *
 * Everything is data-driven: the catalogue is whatever the employee has created
 * for this insurance type, and each attached benefit renders the fields its own
 * definition declares.
 */
export function ConfigurationOptionsBoard({
  configurationId,
  insuranceTypeId,
  attached,
  available,
}: {
  configurationId: string;
  insuranceTypeId: string;
  attached: PlanOptionDto[];
  available: InsuranceOptionDto[];
}) {
  const { notify } = useToast();
  const addOption = useAddPlanOption(configurationId);
  const removeOption = useRemovePlanOption();
  const reorder = useReorderPlanOptions(configurationId);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Local order so reordering feels immediate; the server is the authority. */
  const [order, setOrder] = useState<string[] | null>(null);
  const [editingOption, setEditingOption] = useState<InsuranceOptionDto | null | undefined>(
    undefined,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedAttached = order
    ? order.flatMap((id) => attached.find((item) => item.id === id) ?? [])
    : attached;

  const attachedOptionIds = new Set(attached.map((item) => item.optionId));
  const catalogue = available.filter((option) => !attachedOptionIds.has(option.id));

  function attach(optionId: string) {
    addOption.mutate(optionId, {
      onSuccess: () => {
        setOrder(null);
        notify('Benefit added to this configuration.');
      },
      onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Catalogue item dropped onto the coverage list.
    if (activeId.startsWith(AVAILABLE)) {
      const droppedInside = overId === DROP_ZONE || attached.some((item) => item.id === overId);
      if (!droppedInside) return;
      attach(activeId.slice(AVAILABLE.length));
      return;
    }

    // Reordering within the coverage list.
    if (activeId === overId) return;
    const currentIds = orderedAttached.map((item) => item.id);
    const from = currentIds.indexOf(activeId);
    const to = currentIds.indexOf(overId);
    if (from === -1 || to === -1) return;

    const next = arrayMove(currentIds, from, to);
    setOrder(next);
    reorder.mutate(next, {
      onSuccess: () => setOrder(null),
      onError: (error) => {
        setOrder(null);
        notify(describeError(error, 'the benefit order'), 'error');
      },
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        {/* Plan coverage — the main column on desktop, second on mobile. */}
        <Card className="order-last lg:order-first">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Plan coverage
                <Badge tone="brand">{orderedAttached.length}</Badge>
              </span>
            }
            description="Benefits included in this configuration, in display order."
            icon={<IconShield className="size-5" />}
          />
          <CardBody>
            <CoverageDropZone isEmpty={orderedAttached.length === 0} isDragging={draggingId !== null}>
              <SortableContext
                items={orderedAttached.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {orderedAttached.map((planOption) => (
                    <AttachedBenefit
                      key={planOption.id}
                      planOption={planOption}
                      onRemove={() =>
                        removeOption.mutate(planOption.id, {
                          onSuccess: () => {
                            setOrder(null);
                            notify(`${planOption.optionName} was removed.`);
                          },
                          onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
                        })
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </CoverageDropZone>
          </CardBody>
        </Card>

        {/* Available options — a sticky side panel on desktop. */}
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
                  ? 'No benefits exist for this insurance type yet. Create the first one below.'
                  : 'Every available benefit is already on this configuration.'}
              </p>
            ) : (
              catalogue.map((option) => (
                <AvailableBenefit
                  key={option.id}
                  option={option}
                  disabled={addOption.isPending}
                  onAdd={() => attach(option.id)}
                  onEdit={() => setEditingOption(option)}
                />
              ))
            )}

            <Button
              variant="soft"
              fullWidth
              className="mt-3"
              onClick={() => setEditingOption(null)}
            >
              <IconAdd className="size-4" />
              New benefit
            </Button>

            <p className="text-content-subtle mt-2 text-center text-[0.7rem] leading-relaxed">
              You define every benefit and the fields it needs — nothing is preset.
            </p>
          </CardBody>
        </Card>
      </div>

      {editingOption !== undefined ? (
        <OptionEditorDialog
          insuranceTypeId={insuranceTypeId}
          option={editingOption}
          onClose={() => setEditingOption(undefined)}
        />
      ) : null}
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

/** A catalogue entry: draggable, with buttons as the keyboard-friendly path. */
function AvailableBenefit({
  option,
  onAdd,
  onEdit,
  disabled,
}: {
  option: InsuranceOptionDto;
  onAdd: () => void;
  onEdit: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${AVAILABLE}${option.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'border-border-subtle bg-surface hover:border-brand-border flex items-center gap-2 rounded-(--radius-control) border p-2.5 transition-colors',
        isDragging && 'opacity-50 shadow-(--shadow-raised)',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${option.name}`}
        className="text-content-subtle hover:text-content cursor-grab touch-none"
      >
        <IconGrip />
      </button>

      <span className="min-w-0 flex-1">
        <span className="text-content block truncate text-sm font-medium">{option.name}</span>
        <span className="text-content-subtle block text-xs">
          {option.fields?.length ?? 0} fields
        </span>
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${option.name}`}
        className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-1.5"
      >
        <IconEdit className="size-4" />
      </button>
      {/* Named per benefit: several Add buttons share this list. */}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Add ${option.name}`}
        className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) px-2 py-1 text-xs font-semibold disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

/** An attached benefit: sortable, removable, with its generated value form. */
function AttachedBenefit({
  planOption,
  onRemove,
}: {
  planOption: PlanOptionDto;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: planOption.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface rounded-(--radius-card) border p-4',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Reorder ${planOption.optionName}`}
          className="text-content-subtle hover:text-content cursor-grab touch-none"
        >
          <IconGrip />
        </button>
        <h3 className="text-content min-w-0 flex-1 truncate font-semibold">
          {planOption.optionName}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${planOption.optionName}`}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-2"
        >
          <IconTrash className="size-4" />
        </button>
      </div>

      <div className="mt-4">
        <PlanOptionValuesForm planOption={planOption} />
      </div>
    </div>
  );
}
