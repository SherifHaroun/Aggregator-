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
import { Card, CardBody, CardHeader, describeError, useToast } from '@/components/ui';
import {
  useAddPlanOption,
  useRemovePlanOption,
  useReorderPlanOptions,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';
import { PlanOptionValuesForm } from './PlanOptionValuesForm';

/** Prefix distinguishing a catalogue item from an already-attached option. */
const AVAILABLE = 'available:';
const DROP_ZONE = 'configuration-drop-zone';

/**
 * Drag benefits from the catalogue onto this configuration, reorder them, and
 * configure their values.
 *
 * Everything is data-driven: the catalogue is whatever the employee has created
 * for this insurance type, and each attached benefit renders the fields its own
 * definition declares.
 */
export function ConfigurationOptionsBoard({
  configurationId,
  attached,
  available,
}: {
  configurationId: string;
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedAttached = order
    ? order.flatMap((id) => attached.find((item) => item.id === id) ?? [])
    : attached;

  const attachedOptionIds = new Set(attached.map((item) => item.optionId));
  const catalogue = available.filter((option) => !attachedOptionIds.has(option.id));

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Catalogue item dropped onto the configuration.
    if (activeId.startsWith(AVAILABLE)) {
      const optionId = activeId.slice(AVAILABLE.length);
      const droppedInside = overId === DROP_ZONE || attached.some((item) => item.id === overId);
      if (!droppedInside) return;
      attach(optionId);
      return;
    }

    // Reordering within the configuration.
    if (activeId === overId) return;
    const currentIds = orderedAttached.map((item) => item.id);
    const from = currentIds.indexOf(activeId);
    const to = currentIds.indexOf(overId);
    if (from === -1 || to === -1) return;

    const next = arrayMove(currentIds, from, to);
    setOrder(next);
    reorder.mutate(next, {
      onError: (error) => {
        setOrder(null);
        notify(describeError(error, 'the benefit order'), 'error');
      },
      onSuccess: () => setOrder(null),
    });
  }

  function attach(optionId: string) {
    addOption.mutate(optionId, {
      onSuccess: () => {
        setOrder(null);
        notify('Benefit added to this configuration.');
      },
      onError: (error) => notify(describeError(error, 'the benefit'), 'error'),
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <Card className="lg:sticky lg:top-8">
          <CardHeader title="Available benefits" description="Drag onto the configuration." />
          <CardBody className="space-y-2">
            {catalogue.length === 0 ? (
              <p className="text-content-subtle text-sm">
                {available.length === 0
                  ? 'No benefits have been created for this insurance type yet.'
                  : 'Every available benefit is already on this configuration.'}
              </p>
            ) : (
              catalogue.map((option) => (
                <AvailableOption
                  key={option.id}
                  option={option}
                  onAdd={() => attach(option.id)}
                  disabled={addOption.isPending}
                />
              ))
            )}
          </CardBody>
        </Card>

        <DropZone isEmpty={orderedAttached.length === 0} isDragging={draggingId !== null}>
          <SortableContext
            items={orderedAttached.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {orderedAttached.map((planOption) => (
                <AttachedOption
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
        </DropZone>
      </div>
    </DndContext>
  );
}

function DropZone({
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
        'rounded-(--radius-card) border-2 border-dashed p-4 transition-colors',
        isOver ? 'border-brand bg-brand-soft' : 'border-border-subtle bg-surface-muted/30',
        isDragging && !isOver && 'border-border-strong',
      )}
    >
      {isEmpty ? (
        <p className="text-content-subtle py-10 text-center text-sm">
          Drag benefits here, or use the Add button on a benefit.
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** A catalogue entry: draggable, with a button as the keyboard-friendly path. */
function AvailableOption({
  option,
  onAdd,
  disabled,
}: {
  option: InsuranceOptionDto;
  onAdd: () => void;
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
        'border-border-subtle bg-surface flex items-center gap-2 rounded-(--radius-control) border p-3',
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
        <GripIcon />
      </button>
      <span className="min-w-0 flex-1">
        <span className="text-content block truncate text-sm font-medium">{option.name}</span>
        <span className="text-content-subtle block text-xs">
          {option.fields?.length ?? 0} fields
        </span>
      </span>
      {/* Named per benefit: several "Add" buttons share this list. */}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Add ${option.name}`}
        className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) px-2 py-1 text-xs font-medium disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

/** An attached benefit: sortable, removable, with its generated value form. */
function AttachedOption({
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
          <GripIcon />
        </button>
        <h3 className="text-content min-w-0 flex-1 truncate font-semibold">
          {planOption.optionName}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${planOption.optionName}`}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) px-2.5 py-1.5 text-sm font-medium"
        >
          Remove
        </button>
      </div>

      <div className="mt-4">
        <PlanOptionValuesForm planOption={planOption} />
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}
