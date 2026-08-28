import {
  BENEFIT_CHOICES_LABEL,
  BENEFIT_CHOICE_MAX,
  BENEFIT_RANKED_CHOICES_LABEL,
  NO_BENEFIT_CHOICES_LABEL,
  type OptionChoiceDto,
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
import { useMemo, useState } from 'react';
import { Input, IconGrip, IconTrash, describeError, useToast } from '@/components/ui';
import {
  useCreateOptionChoice,
  useDeleteOptionChoice,
  useReorderOptionChoices,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';

/**
 * The answers a benefit offers, and — when it is ranked — the ORDER that says
 * how good each one is.
 *
 * "Golden Care Network" is not a percentage, so no figure can express that it
 * beats "Orange Care Network". An employee knows it, and this is where they say
 * it: once, on the benefit, by dragging the list into order. Every plan quoting
 * a network is then ranked by where its answer sits, with no per-plan judgement
 * and no free text for the comparison to guess at.
 *
 * The same list serves an ordinary text benefit as suggestions, where the order
 * is only the order they appear in.
 */
export function BenefitAnswersEditor({
  optionId,
  choices,
  ranked,
}: {
  optionId: string;
  choices: OptionChoiceDto[];
  /** True when position decides quality — a RANK benefit. */
  ranked: boolean;
}) {
  const { notify } = useToast();
  const create = useCreateOptionChoice(optionId);
  const remove = useDeleteOptionChoice(optionId);
  const reorder = useReorderOptionChoices(optionId);

  const [label, setLabel] = useState('');
  /**
   * The order shown while a drag is being saved, so the row stays where it was
   * dropped instead of snapping back until the server answers.
   */
  const [pending, setPending] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    if (!pending) return choices;
    const byId = new Map(choices.map((choice) => [choice.id, choice]));
    return pending.flatMap((id) => byId.get(id) ?? []);
  }, [choices, pending]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ordered.findIndex((choice) => choice.id === active.id);
    const to = ordered.findIndex((choice) => choice.id === over.id);
    if (from === -1 || to === -1) return;

    const orderedIds = arrayMove(ordered, from, to).map((choice) => choice.id);
    setPending(orderedIds);
    reorder.mutate(
      { orderedIds },
      {
        onSettled: () => setPending(null),
        onError: (error) => notify(describeError(error, 'the order'), 'error'),
      },
    );
  }

  function add() {
    const trimmed = label.trim();
    if (trimmed === '') return;

    create.mutate(
      { label: trimmed },
      {
        onSuccess: () => setLabel(''),
        onError: (error) => notify(describeError(error, 'the answer'), 'error'),
      },
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-content text-sm font-medium">
          {ranked ? BENEFIT_RANKED_CHOICES_LABEL : BENEFIT_CHOICES_LABEL}
        </p>
        <p className="text-content-subtle text-xs leading-snug">
          {ranked
            ? 'Drag to reorder. The top answer is the best cover, and every plan that gives it is ranked accordingly.'
            : 'Offered when filling this benefit in, so one answer stays one answer. Anything else can still be typed.'}
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-4 text-center text-xs">
          {ranked ? NO_BENEFIT_CHOICES_LABEL : 'No answers yet.'}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={ordered.map((choice) => choice.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="space-y-1">
              {ordered.map((choice, index) => (
                <AnswerRow
                  key={choice.id}
                  choice={choice}
                  position={index + 1}
                  ranked={ranked}
                  onRemove={() =>
                    remove.mutate(
                      { choiceId: choice.id },
                      { onError: (error) => notify(describeError(error, 'the answer'), 'error') }
                    )
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {ordered.length >= BENEFIT_CHOICE_MAX ? null : (
        <div className="flex items-center gap-2">
          <Input
            value={label}
            placeholder={ranked ? 'Add an answer, e.g. a network name' : 'Add an answer'}
            aria-label="New answer"
            disabled={create.isPending}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            className="py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={create.isPending || label.trim() === ''}
            className="text-brand-strong hover:bg-brand-soft shrink-0 rounded-(--radius-control) px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {create.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One answer.
 *
 * A new answer is added at the BOTTOM, never the top: on a ranked benefit the
 * top is "best cover we know of", and landing there by default would quietly
 * re-rank every plan that quotes the others.
 */
function AnswerRow({
  choice,
  position,
  ranked,
  onRemove,
}: {
  choice: OptionChoiceDto;
  position: number;
  ranked: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: choice.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface flex items-center gap-2 rounded-(--radius-control) border px-2 py-1.5',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${choice.label}`}
        className="text-content-subtle hover:text-content cursor-grab touch-none"
      >
        <IconGrip />
      </button>

      {ranked ? (
        <span className="text-content-subtle w-5 shrink-0 text-xs tabular-nums">{position}.</span>
      ) : null}

      <span className="text-content min-w-0 flex-1 truncate text-sm">{choice.label}</span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${choice.label}`}
        className="text-danger hover:bg-danger-soft rounded-(--radius-control) p-1.5"
      >
        <IconTrash className="size-3.5" />
      </button>
    </li>
  );
}
