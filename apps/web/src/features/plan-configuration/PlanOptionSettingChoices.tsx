import {
  LIMITATION_RANK_LABEL,
  NO_LIMITATIONS_DEFINED_LABEL,
  type OptionChoiceDto,
  type PlanOptionValueDto,
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
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { IconEdit, IconGrip, IconTrash, Input, describeError, useToast } from '@/components/ui';
import {
  useCreateOptionChoice,
  useDeleteOptionChoice,
  useReorderOptionChoices,
  useSaveOptionChoice,
  useSavePlanOptionChoices,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';

/**
 * One setting of a benefit that takes SEVERAL answers — what an inpatient stay
 * includes, which conditions apply to a dental limit.
 *
 * The list belongs to this setting and to nothing else, which is the whole
 * point: inpatient cover asks about a room type and about network access at the
 * same time, and neither list is an answer to the other's question.
 *
 * TICKING says which answers this plan gives. RANKING — dragging the list into
 * order, mildest first — says what each answer is worth, for every plan at once.
 * Nobody can say whether in-network-only is "worth 0.30"; anyone in the business
 * can say whether it is harsher than a co-payment, so that is the only question
 * asked.
 *
 * NOTHING TICKED MEANS NOTHING RECORDED, which for a restriction reads as
 * unqualified cover. The control says so rather than looking unfilled.
 */
export const PlanOptionSettingChoices = memo(function PlanOptionSettingChoices({
  planOptionId,
  planConfigurationId,
  optionName,
  value,
  disabled = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  /** The MULTI setting: its label, its answers, and what is ticked. */
  value: PlanOptionValueDto;
  disabled?: boolean;
}) {
  const save = useSavePlanOptionChoices();
  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  /** Ticking and ranking are different jobs, so they are different modes. */
  const [managing, setManaging] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const answers = useMemo(() => value.choices ?? [], [value.choices]);
  const ticked = useMemo(() => new Set(value.selectedChoiceIds ?? []), [value.selectedChoiceIds]);
  const tickedNames = answers.filter((answer) => ticked.has(answer.id)).map((a) => a.label);

  // Clicking away puts the list back, exactly as a dropdown would.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setManaging(false);
  }, [open]);

  function toggle(answer: OptionChoiceDto) {
    const next = ticked.has(answer.id)
      ? [...ticked].filter((id) => id !== answer.id)
      : [...ticked, answer.id];

    save.mutate(
      {
        planOptionId,
        planConfigurationId,
        optionFieldId: value.optionFieldId,
        choiceIds: next,
      },
      { onError: (error) => notify(describeError(error, value.fieldLabel), 'error') },
    );
  }

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={`${value.fieldLabel} for ${optionName}`}
        className={cn(
          'flex w-fit max-w-full items-center gap-1.5 rounded-(--radius-control) px-1.5 py-0.5 text-left text-xs font-medium',
          tickedNames.length > 0
            ? 'text-content-subtle hover:bg-surface-muted'
            : 'text-content-subtle hover:text-brand-strong hover:bg-brand-soft',
        )}
      >
        <span className="truncate">
          {tickedNames.length === 0 ? `+ ${value.fieldLabel}` : tickedNames.join(' · ')}
        </span>
        {save.isPending ? <span className="shrink-0">Saving…</span> : null}
      </button>

      {open ? (
        <div className="border-border-subtle bg-surface shadow-(--shadow-raised) absolute z-20 mt-1 w-80 rounded-(--radius-card) border p-2">
          <div className="flex items-baseline justify-between gap-2 px-1.5 pb-1.5">
            <p className="text-content-subtle text-xs">
              {managing ? LIMITATION_RANK_LABEL : value.fieldLabel}
            </p>
            <button
              type="button"
              onClick={() => setManaging((current) => !current)}
              className="text-brand-strong hover:bg-brand-soft shrink-0 rounded-(--radius-control) px-1.5 py-0.5 text-xs font-semibold"
            >
              {managing ? 'Done' : 'Rank & edit'}
            </button>
          </div>

          {answers.length === 0 ? (
            <p className="text-content-subtle px-1.5 py-2 text-xs">{NO_LIMITATIONS_DEFINED_LABEL}</p>
          ) : managing ? (
            <AnswerRanking optionFieldId={value.optionFieldId} answers={answers} />
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {answers.map((answer) => (
                <label
                  key={answer.id}
                  className="hover:bg-surface-muted flex cursor-pointer items-start gap-2 rounded-(--radius-control) px-1.5 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={ticked.has(answer.id)}
                    onChange={() => toggle(answer)}
                    disabled={disabled || save.isPending}
                    className="mt-0.5"
                  />
                  <span className="text-content min-w-0 flex-1">{answer.label}</span>
                </label>
              ))}
            </div>
          )}

          {managing ? null : (
            <NewAnswer optionFieldId={value.optionFieldId} onCreated={toggle} />
          )}
        </div>
      ) : null}
    </div>
  );
});

/**
 * The ranking, and the only place an answer can be renamed or removed.
 *
 * Order is the weighting: the top answer is the mildest this setting offers and
 * costs a plan nothing, the bottom is the harshest and costs the most, and
 * everything between is spaced evenly. One drag is a complete judgement.
 */
function AnswerRanking({
  optionFieldId,
  answers,
}: {
  optionFieldId: string;
  answers: OptionChoiceDto[];
}) {
  const { notify } = useToast();
  const reorder = useReorderOptionChoices();
  const [pending, setPending] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    if (!pending) return answers;
    const byId = new Map(answers.map((answer) => [answer.id, answer]));
    return pending.flatMap((id) => byId.get(id) ?? []);
  }, [answers, pending]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ordered.findIndex((answer) => answer.id === active.id);
    const to = ordered.findIndex((answer) => answer.id === over.id);
    if (from === -1 || to === -1) return;

    const orderedIds = arrayMove(ordered, from, to).map((answer) => answer.id);
    setPending(orderedIds);
    reorder.mutate(
      { optionFieldId, orderedIds },
      {
        onSettled: () => setPending(null),
        onError: (error) => notify(describeError(error, 'the ranking'), 'error'),
      },
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={ordered.map((answer) => answer.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-1">
            {ordered.map((answer, index) => (
              <RankedAnswer
                key={answer.id}
                optionFieldId={optionFieldId}
                answer={answer}
                position={index + 1}
                total={ordered.length}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** One row of the ranking: drag to move it, rename it, or delete it. */
function RankedAnswer({
  optionFieldId,
  answer,
  position,
  total,
}: {
  optionFieldId: string;
  answer: OptionChoiceDto;
  position: number;
  total: number;
}) {
  const { notify } = useToast();
  const save = useSaveOptionChoice();
  const remove = useDeleteOptionChoice();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(answer.label);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: answer.id,
  });

  function commit() {
    const trimmed = label.trim();
    if (trimmed === '' || trimmed === answer.label) {
      setLabel(answer.label);
      setEditing(false);
      return;
    }
    save.mutate(
      { optionFieldId, choiceId: answer.id, label: trimmed },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => {
          setLabel(answer.label);
          notify(describeError(error, 'the answer'), 'error');
        },
      },
    );
  }

  /**
   * Deleting an answer plans record takes it off those plans too, so the API
   * refuses without `force` and the count is put to the employee first.
   */
  function handleDelete() {
    remove.mutate(
      { optionFieldId, choiceId: answer.id },
      {
        onError: (error) => {
          const message = describeError(error, 'the answer');
          if (window.confirm(`${message}\n\nRemove it from those plans as well?`)) {
            remove.mutate(
              { optionFieldId, choiceId: answer.id, force: true },
              { onError: (retry) => notify(describeError(retry, 'the answer'), 'error') },
            );
          }
        },
      },
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle bg-surface flex items-center gap-1.5 rounded-(--radius-control) border px-1.5 py-1',
        isDragging && 'shadow-(--shadow-raised) opacity-80',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${answer.label}`}
        className="text-content-subtle hover:text-content cursor-grab touch-none"
      >
        <IconGrip />
      </button>

      <span className="text-content-subtle w-4 shrink-0 text-xs tabular-nums">{position}.</span>

      {editing ? (
        <Input
          autoFocus
          value={label}
          aria-label={`Rename ${answer.label}`}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              setLabel(answer.label);
              setEditing(false);
            }
          }}
          className="py-0.5 text-xs"
        />
      ) : (
        <span className="text-content min-w-0 flex-1 truncate text-xs">
          {answer.label}
          {/* Naming the two ends keeps the order from being a guess. */}
          <span className="text-content-subtle ml-1">
            {position === 1 ? '· mildest' : position === total ? '· harshest' : null}
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${answer.label}`}
        className="text-content-subtle hover:text-brand-strong shrink-0 rounded-(--radius-control) p-1"
      >
        <IconEdit className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={remove.isPending}
        aria-label={`Delete ${answer.label}`}
        className="text-danger hover:bg-danger-soft shrink-0 rounded-(--radius-control) p-1"
      >
        <IconTrash className="size-3.5" />
      </button>
    </li>
  );
}

/**
 * Add an answer this setting does not offer yet, without leaving the row.
 *
 * An employee meets an unlisted wording exactly while entering the plan that
 * uses it. Sending them to another screen is how everything ended up in a
 * free-text note in the first place.
 *
 * It lands at the HARSHEST end, which is deliberate: an unranked answer is an
 * unknown, and treating an unknown as mild would quietly flatter every plan
 * that carries it.
 */
function NewAnswer({
  optionFieldId,
  onCreated,
}: {
  optionFieldId: string;
  onCreated: (answer: OptionChoiceDto) => void;
}) {
  const create = useCreateOptionChoice();
  const { notify } = useToast();
  const [label, setLabel] = useState('');

  function submit() {
    const trimmed = label.trim();
    if (trimmed === '') return;

    create.mutate(
      { optionFieldId, label: trimmed },
      {
        onSuccess: (created) => {
          setLabel('');
          onCreated(created);
        },
        onError: (error) => notify(describeError(error, 'the answer'), 'error'),
      },
    );
  }

  return (
    <div className="border-border-subtle mt-1.5 flex items-center gap-1.5 border-t pt-1.5">
      <Input
        value={label}
        placeholder="Add an answer…"
        aria-label="New answer"
        disabled={create.isPending}
        onChange={(event) => setLabel(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        className="py-1 text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={create.isPending || label.trim() === ''}
        className="text-brand-strong hover:bg-brand-soft shrink-0 rounded-(--radius-control) px-2 py-1 text-xs font-semibold disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
